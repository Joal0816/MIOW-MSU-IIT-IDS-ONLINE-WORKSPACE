import { Pool } from "pg";

const DATABASE_URL =
  process.env["DATABASE_URL"] ?? "postgres://miow:miow_dev_password@localhost:5432/miow";

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 1000;

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log(`[wait-for-pg] Postgres is ready (attempt ${attempt}/${MAX_RETRIES})`);
      await pool.end();
      return;
    } catch {
      if (attempt === MAX_RETRIES) {
        console.error(`[wait-for-pg] Postgres not ready after ${MAX_RETRIES} attempts — aborting`);
        await pool.end();
        process.exit(1);
      }
      console.log(`[wait-for-pg] Waiting for Postgres... (attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
    }
  }
}

main();
