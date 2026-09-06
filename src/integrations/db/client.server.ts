// Database client — supports both Supabase and local Postgres.
// Auto-detects based on env vars:
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY → Supabase client
//   DATABASE_URL → local Postgres via pg Pool
//
// Server code uses `db.from('table').select()...` which works identically
// with both backends thanks to Supabase's query builder API.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Pool, type QueryResult } from "pg";

// ── Env detection ───────────────────────────────────────────────────

const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "";
const SUPABASE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const DATABASE_URL = process.env["DATABASE_URL"] ?? process.env["POSTGRES_URL"] ?? "";

const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);
const USE_PG = !!DATABASE_URL;

if (!USE_SUPABASE && !USE_PG) {
  console.error(
    "[db] No database configured. Set SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL.",
  );
}

// ── Supabase client ─────────────────────────────────────────────────

let _supabase: SupabaseClient | undefined;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  if (!USE_SUPABASE)
    throw new Error(
      "[db] Supabase not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)",
    );
  _supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (process.env["DEBUG_LOGS"]) console.log(`[db] Using Supabase backend (${SUPABASE_URL})`);
  return _supabase;
}

// ── Local Postgres pool ─────────────────────────────────────────────

let _pool: Pool | undefined;

function getPool(): Pool {
  if (_pool) return _pool;
  if (!USE_PG) throw new Error("[db] Postgres not configured (missing DATABASE_URL)");
  _pool = new Pool({ connectionString: DATABASE_URL });
  _pool.on("error", (err) => console.error("[db] pool error", err));
  if (process.env["DEBUG_LOGS"])
    console.log(`[db] Using local Postgres (${DATABASE_URL.replace(/:.*@/, ":***@")})`);
  return _pool;
}

// For tests / HMR: allow resetting pool
export function _resetPool() {
  _pool = undefined;
  _supabase = undefined;
}

// Re-export getPool for raw query access
export function getPoolRaw(): Pool {
  return getPool();
}

// ── Unified db export ───────────────────────────────────────────────
// When Supabase is configured, use its native client directly.
// When Postgres is configured, use the QueryBuilder compat layer.

import { storage as localStorage } from "./storage";

// Storage backend: Supabase Storage when SUPABASE_URL is set (and no STORAGE_PATH override),
// local filesystem otherwise. Set STORAGE_PATH to force local even on Supabase.
const storageBackend =
  USE_SUPABASE && !process.env["STORAGE_PATH"] ? getSupabase().storage : localStorage;

interface DbError {
  code?: string;
  message?: string;
}

interface DbQueryBuilder extends PromiseLike<{ data: unknown; error: DbError | null }> {
  select(cols?: string, opts?: Record<string, unknown>): DbQueryBuilder;
  insert(data: unknown): DbQueryBuilder;
  update(data: Record<string, unknown>): DbQueryBuilder;
  delete(): DbQueryBuilder;
  eq(col: string, val: unknown): DbQueryBuilder;
  gte(col: string, val: unknown): DbQueryBuilder;
  ilike(col: string, val: string): DbQueryBuilder;
  is(col: string, val: unknown): DbQueryBuilder;
  in(col: string, vals: unknown[]): DbQueryBuilder;
  order(col: string, opts?: { ascending?: boolean }): DbQueryBuilder;
  limit(n: number): DbQueryBuilder;
  maybeSingle(): DbQueryBuilder;
  single(): DbQueryBuilder;
}

type DbLike = {
  from(table: string): DbQueryBuilder;
};

let _db: DbLike;

if (USE_SUPABASE) {
  // Supabase client already has .from() — use it directly
  const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  _db = admin as unknown as DbLike;
} else {
  // Build the QueryBuilder compat layer for pg
  _db = createPgCompatLayer();
}

export const db: DbLike & { storage: typeof storageBackend } = Object.assign(_db, {
  storage: storageBackend,
});

// supabaseAdmin is an alias for db (for routes that import it by name)
export const supabaseAdmin = db;

// ── Pg QueryBuilder compat layer (Supabase-like API over raw pg) ────

function createPgCompatLayer(): DbLike {
  type Filter =
    | { type: "eq"; col: string; val: unknown }
    | { type: "gte"; col: string; val: unknown }
    | { type: "ilike"; col: string; val: string }
    | { type: "is"; col: string; val: unknown }
    | { type: "in"; col: string; vals: unknown[] };

  class QueryBuilder implements PromiseLike<{ data: unknown; error: DbError | null }> {
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
      this.returning = "*";
      return this;
    }

    update(data: Record<string, unknown>): this {
      this.op = "update";
      this.updateData = data;
      this.returning = null;
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

    gte(col: string, val: unknown): this {
      this.filters.push({ type: "gte", col, val });
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

    then<TResult1 = { data: unknown; error: DbError | null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: DbError | null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ): PromiseLike<TResult1 | TResult2> {
      return this.execute().then(onfulfilled, onrejected);
    }

    private async execute(): Promise<{ data: unknown; error: DbError | null }> {
      try {
        const pool = getPool();
        return await this.run(pool);
      } catch (e: unknown) {
        const err = e as { code?: string; message?: string };
        return {
          data: null,
          error: { code: err?.code ?? "UNKNOWN", message: err?.message ?? String(e) },
        };
      }
    }

    private async run(pool: Pool): Promise<{ data: unknown; error: DbError | null }> {
      const table = `public.${this.table}`;
      const params: unknown[] = [];
      let idx = 1;

      const whereClause = (): string => {
        if (!this.filters.length) return "";
        const parts = this.filters.map((f) => {
          if (f.type === "eq") {
            params.push(f.val);
            return `${qi(f.col)} = $${idx++}`;
          }
          if (f.type === "gte") {
            params.push(f.val);
            return `${qi(f.col)} >= $${idx++}`;
          }
          if (f.type === "ilike") {
            params.push(f.val);
            return `${qi(f.col)} ILIKE $${idx++}`;
          }
          if (f.type === "is") {
            if (f.val === null) return `${qi(f.col)} IS NULL`;
            params.push(f.val);
            return `${qi(f.col)} IS $${idx++}`;
          }
          if (f.type === "in") {
            if (!f.vals.length) return "FALSE";
            const ph = f.vals.map((v) => {
              params.push(v);
              return `$${idx++}`;
            });
            return `${qi(f.col)} IN (${ph.join(", ")})`;
          }
          return "";
        });
        return `WHERE ${parts.join(" AND ")}`;
      };

      const orderClause = (): string =>
        this.orders.length ? `ORDER BY ${this.orders.map(qi).join(", ")}` : "";

      const returningClause = (): string => {
        if (!this.returning) return "";
        return this.returning === "*" ? "RETURNING *" : `RETURNING ${this.returning}`;
      };

      if (this.op === "select") {
        const cols = this.selectCols === "*" ? "*" : this.selectCols;
        const sql =
          `SELECT ${cols} FROM ${table} ${whereClause()} ${orderClause()} ${this.limitOne ? "LIMIT 1" : ""}`.trim();
        const res: QueryResult = await pool.query(sql + ";", params);
        if (this.limitOne) {
          if (!res.rows.length) {
            if (this.expectSingle)
              return { data: null, error: { code: "PGRST116", message: "No rows found" } };
            return { data: null, error: null };
          }
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }

      if (this.op === "insert") {
        const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
        if (!rows.length) return { data: [], error: null };
        const keys = Object.keys(rows[0] as Record<string, unknown>);
        const colsSql = keys.map(qi).join(", ");
        const valuesSql = rows
          .map((row) => {
            const vals = keys.map((k) => {
              params.push((row as Record<string, unknown>)[k]);
              return `$${idx++}`;
            });
            return `(${vals.join(", ")})`;
          })
          .join(", ");
        const sql =
          `INSERT INTO ${table} (${colsSql}) VALUES ${valuesSql} ${returningClause()};`.trim();
        const res = await pool.query(sql, params);
        if (this.limitOne) {
          if (!res.rows.length) {
            if (this.expectSingle)
              return { data: null, error: { code: "PGRST116", message: "No rows found" } };
            return { data: null, error: null };
          }
          return { data: res.rows[0], error: null };
        }
        return { data: res.rows, error: null };
      }

      if (this.op === "update") {
        const data = this.updateData ?? {};
        const keys = Object.keys(data);
        if (!keys.length) return { data: [], error: null };
        const setSql = keys
          .map((k) => {
            params.push(data[k]);
            return `${qi(k)} = $${idx++}`;
          })
          .join(", ");
        const where = whereClause();
        const sql = `UPDATE ${table} SET ${setSql} ${where} ${returningClause()};`.trim();
        const res = await pool.query(sql, params);
        if (this.returning) {
          if (this.limitOne) {
            if (!res.rows.length) {
              if (this.expectSingle)
                return { data: null, error: { code: "PGRST116", message: "No rows found" } };
              return { data: null, error: null };
            }
            return { data: res.rows[0], error: null };
          }
          return { data: res.rows, error: null };
        }
        return { data: res.rows, error: null };
      }

      if (this.op === "delete") {
        const where = whereClause();
        if (!where) throw new Error("Delete without WHERE is not allowed");
        const sql = `DELETE FROM ${table} ${where} ${returningClause()};`.trim();
        const res = await pool.query(sql, params);
        if (this.returning) {
          if (this.limitOne) {
            if (!res.rows.length) {
              if (this.expectSingle)
                return { data: null, error: { code: "PGRST116", message: "No rows found" } };
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

  function qi(ident: string): string {
    return ident
      .split(".")
      .map((p) => `"${p.replace(/"/g, '""')}"`)
      .join(".");
  }

  return {
    from(table: string) {
      return new QueryBuilder(table);
    },
  };
}
