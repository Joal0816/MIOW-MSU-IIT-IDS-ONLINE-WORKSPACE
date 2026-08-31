// Local Postgres client — replaces Supabase for database access.
// Provides a Supabase-like query builder backed by `pg` Pool, so
// `src/lib/lms.server.ts` needs only an import change.
//
// Env: DATABASE_URL=postgres://user:pass@localhost:5432/miow
// Falls back to mock error if not configured (dev server without DB still boots).

import { Pool, type QueryResult } from "pg";

const DATABASE_URL = process.env["DATABASE_URL"] ?? process.env["POSTGRES_URL"] ?? "";

let _pool: Pool | undefined;
let _warnedNoDb = false;

export function getPool(): Pool {
  if (_pool) return _pool;
  if (!DATABASE_URL) {
    if (!_warnedNoDb) {
      console.warn("[db] DATABASE_URL not set — using in-memory mock (no persistence). Set DATABASE_URL for real Postgres.");
      _warnedNoDb = true;
    }
    // Return a mock pool that keeps dev server + Playwright happy without a real DB.
    // Real queries will get empty results / no-ops instead of crashing.
    _pool = new Proxy({} as Pool, {
      get(_target, prop) {
        if (prop === "query") {
          return async (sql: string) => {
            const isSelect = /^\s*SELECT/i.test(sql);
            if (isSelect) return { rows: [], rowCount: 0 } as unknown as QueryResult;
            // INSERT/UPDATE/DELETE: return empty RETURNING
            return { rows: [], rowCount: 0 } as unknown as QueryResult;
          };
        }
        if (prop === "on") return () => {};
        return () => {};
      },
    }) as unknown as Pool;
    return _pool;
  }
  _pool = new Pool({
    connectionString: DATABASE_URL,
    // Render/Neon/Supabase require SSL; local pg doesn't. `ssl` is auto-negotiated by pg
    // when the URL contains `?sslmode=require`. For local docker, no SSL needed.
  });
  _pool.on("error", (err) => console.error("[db] pool error", err));
  return _pool;
}

// For tests / HMR: allow resetting pool
export function _resetPool() {
  _pool = undefined;
}

// ---------- Supabase-like compat layer ----------

type Filter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "ilike"; col: string; val: string }
  | { type: "is"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] };

class QueryBuilder implements PromiseLike<{ data: unknown; error: unknown }> {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" = "select";
  private selectCols: string = "*";
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitOne: boolean = false;
  private expectSingle: boolean = false;
  private insertData: unknown = null;
  private updateData: Record<string, unknown> | null = null;
  private returning: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(cols: string = "*"): this {
    // `insert(data).select()` or `update(data).select()` → set RETURNING
    if (this.op === "insert" || this.op === "update" || this.op === "delete") {
      this.returning = cols;
      return this;
    }
    this.op = "select";
    this.selectCols = cols;
    return this;
  }

  insert(data: unknown): this {
    this.op = "insert";
    this.insertData = data;
    this.returning = "*"; // default, may be overridden by .select()
    return this;
  }

  update(data: Record<string, unknown>): this {
    this.op = "update";
    this.updateData = data;
    this.returning = null; // unless .select() called after
    return this;
  }

  delete(): this {
    this.op = "delete";
    this.returning = null;
    return this;
  }

  eq(col: string, val: unknown): this {
    this.filters.push({ type: "eq", col, val });
    return this;
  }

  ilike(col: string, val: string): this {
    this.filters.push({ type: "ilike", col, val });
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push({ type: "is", col, val });
    return this;
  }

  in(col: string, vals: unknown[]): this {
    this.filters.push({ type: "in", col, vals });
    return this;
  }

  order(col: string): this {
    // supabase order can take options object, we just support col name
    this.orders.push(col);
    return this;
  }

  limit(n: number): this {
    if (n === 1) this.limitOne = true;
    return this;
  }

  maybeSingle(): this {
    this.limitOne = true;
    this.expectSingle = false;
    return this;
  }

  single(): this {
    this.limitOne = true;
    this.expectSingle = true;
    return this;
  }

  // PromiseLike — makes `await builder` work and `unwrap(builder)` work
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown; error: unknown }> {
    try {
      const pool = getPool();
      const result = await this.run(pool);
      return result;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      // Normalize to shape `unwrap` expects: { code, message }
      return {
        data: null,
        error: { code: err?.code ?? "UNKNOWN", message: err?.message ?? String(e) },
      };
    }
  }

  private async run(pool: Pool): Promise<{ data: unknown; error: unknown }> {
    const table = `public.${this.table}`;
    const params: unknown[] = [];
    let idx = 1;

    const whereClause = (): string => {
      if (!this.filters.length) return "";
      const parts = this.filters.map((f) => {
        if (f.type === "eq") {
          params.push(f.val);
          return `${quoteIdent(f.col)} = $${idx++}`;
        }
        if (f.type === "ilike") {
          params.push(f.val);
          return `${quoteIdent(f.col)} ILIKE $${idx++}`;
        }
        if (f.type === "is") {
          if (f.val === null) return `${quoteIdent(f.col)} IS NULL`;
          params.push(f.val);
          return `${quoteIdent(f.col)} IS $${idx++}`;
        }
        if (f.type === "in") {
          if (!f.vals.length) return "FALSE";
          const placeholders = f.vals.map((v) => {
            params.push(v);
            return `$${idx++}`;
          });
          return `${quoteIdent(f.col)} IN (${placeholders.join(", ")})`;
        }
        return "";
      });
      return `WHERE ${parts.join(" AND ")}`;
    };

    const orderClause = (): string => {
      if (!this.orders.length) return "";
      return `ORDER BY ${this.orders.map((c) => quoteIdent(c)).join(", ")}`;
    };

    const returningClause = (): string => {
      if (!this.returning) return "";
      if (this.returning === "*") return "RETURNING *";
      // cols like "id, title" → "RETURNING id, title"
      return `RETURNING ${this.returning}`;
    };

    // SELECT
    if (this.op === "select") {
      const cols = this.selectCols === "*" ? "*" : this.selectCols;
      const sql = `SELECT ${cols} FROM ${table} ${whereClause()} ${orderClause()} ${this.limitOne ? "LIMIT 1" : ""}`.trim();
      const res: QueryResult = await pool.query(sql + ";", params);
      if (this.limitOne) {
        if (!res.rows.length) {
          if (this.expectSingle) {
            return { data: null, error: { code: "PGRST116", message: "No rows found" } };
          }
          return { data: null, error: null };
        }
        return { data: res.rows[0], error: null };
      }
      return { data: res.rows, error: null };
    }

    // INSERT
    if (this.op === "insert") {
      const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      if (!rows.length) return { data: [], error: null };
      // Assume uniform keys across rows
      const keys = Object.keys(rows[0] as Record<string, unknown>);
      const colsSql = keys.map(quoteIdent).join(", ");
      const valuesSql = rows
        .map((row) => {
          const vals = keys.map((k) => {
            params.push((row as Record<string, unknown>)[k]);
            return `$${idx++}`;
          });
          return `(${vals.join(", ")})`;
        })
        .join(", ");
      const sql = `INSERT INTO ${table} (${colsSql}) VALUES ${valuesSql} ${returningClause()};`.trim();
      const res = await pool.query(sql, params);
      if (this.limitOne) {
        if (!res.rows.length) {
          if (this.expectSingle) return { data: null, error: { code: "PGRST116", message: "No rows found" } };
          return { data: null, error: null };
        }
        return { data: res.rows[0], error: null };
      }
      // supabase `.insert(...).select()` returns array; `.single()` returns object
      return { data: res.rows, error: null };
    }

    // UPDATE
    if (this.op === "update") {
      const data = this.updateData ?? {};
      const keys = Object.keys(data);
      if (!keys.length) {
        // No-op update, just return empty
        return { data: [], error: null };
      }
      const setSql = keys
        .map((k) => {
          params.push(data[k]);
          return `${quoteIdent(k)} = $${idx++}`;
        })
        .join(", ");
      const where = whereClause();
      const sql = `UPDATE ${table} SET ${setSql} ${where} ${returningClause()};`.trim();
      const res = await pool.query(sql, params);
      if (this.returning) {
        if (this.limitOne) {
          if (!res.rows.length) {
            if (this.expectSingle) return { data: null, error: { code: "PGRST116", message: "No rows found" } };
            return { data: null, error: null };
          }
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }
      return { data: res.rows, error: null };
    }

    // DELETE
    if (this.op === "delete") {
      const where = whereClause();
      if (!where) throw new Error("Delete without WHERE is not allowed");
      const sql = `DELETE FROM ${table} ${where} ${returningClause()};`.trim();
      const res = await pool.query(sql, params);
      if (this.returning) {
        if (this.limitOne) {
          if (!res.rows.length) {
            if (this.expectSingle) return { data: null, error: { code: "PGRST116", message: "No rows found" } };
            return { data: null, error: null };
          }
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }
      return { data: res.rows, error: null };
    }

    return { data: null, error: { code: "UNKNOWN", message: `Unknown op ${this.op}` } };
  }
}

function quoteIdent(ident: string): string {
  // Handle "table.col" or "col" — quote each part
  return ident
    .split(".")
    .map((p) => `"${p.replace(/"/g, '""')}"`)
    .join(".");
}

// Public `db` object mimicking `supabaseAdmin`
export const db = {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  },
};

// For backwards compat: `supabaseAdmin` alias used in some routes that import directly.
// Those routes do `supabaseAdmin.storage.from(...).download` — we expose storage via same object.
import { storage as localStorage } from "./storage";

export const supabaseAdmin: typeof db & { storage: typeof localStorage } = Object.assign(Object.create(db), {
  ...db,
  storage: localStorage,
}) as typeof db & { storage: typeof localStorage };

// Also export as `pgPool` for raw queries if needed
export const pgPool = {
  getPool,
};
