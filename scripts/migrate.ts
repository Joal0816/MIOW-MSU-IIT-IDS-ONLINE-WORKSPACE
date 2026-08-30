import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const DATABASE_URL =
  process.env["DATABASE_URL"] ?? "postgres://miow:miow_dev_password@localhost:5432/miow";

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    // Ensure roles that Supabase migrations expect exist (local postgres doesn't have them by default)
    for (const role of ["anon", "authenticated", "service_role"]) {
      try {
        await pool.query(`CREATE ROLE ${role} NOLOGIN`);
        console.log(`[migrate] created role ${role}`);
      } catch (e: unknown) {
        const msg = (e as { message?: string })?.message ?? "";
        if (!msg.includes("already exists")) throw e;
      }
    }

    // Ensure migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    const { rows: applied } = await pool.query("SELECT name FROM _migrations");
    const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

    let ran = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }
      const full = path.join(dir, file);
      const sql = await readFile(full, "utf-8");
      console.log(`[migrate] applying ${file} ...`);
      try {
        await pool.query(sql);
      } catch (e: unknown) {
        const err = e as { message?: string; position?: string };
        console.error(`[migrate] failed ${file}: ${err.message}`);
        // Don't mark as applied if it failed — let next run retry
        throw e;
      }
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      ran++;
    }

    console.log(`[migrate] done — ${ran} new migrations applied, ${files.length - ran} skipped.`);

    // Also ensure new local tables that are not in Supabase migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _local_meta (key TEXT PRIMARY KEY, value TEXT);
    `);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
