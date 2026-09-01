import { Pool } from "pg";

const DATABASE_URL =
  process.env["DATABASE_URL"] ?? "postgres://miow:miow_dev_password@localhost:5432/miow";

// Seed is already in the first migration (20260822144314...). This script is
// a placeholder for additional seed data. Run `bun run db:migrate` first.
async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const { rows } = await pool.query("SELECT count(*)::int AS c FROM public.profiles");
    console.log(`[seed] profiles count: ${rows[0].c}`);
    if (rows[0].c === 0) {
      console.log(
        "[seed] no profiles — migrations should have seeded default users. Check supabase/migrations/",
      );
    } else {
      console.log("[seed] already seeded — nothing to do.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
