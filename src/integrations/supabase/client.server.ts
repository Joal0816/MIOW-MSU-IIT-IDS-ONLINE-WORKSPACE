// LEGACY SHIM — Supabase has been replaced by local Postgres.
// This file remains for backwards compat: it re-exports the pg-backed `db`.
// New code should import from "@/integrations/db/client" directly.

export { db, supabaseAdmin, getPool, pgPool } from "@/integrations/db/client";
