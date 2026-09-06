# AGENTS.md

## Project Overview

MIOW (MSU-IIT IDS Online Workspace) is a Learning Management System for Junior and Senior High School. Built with TanStack Start, React 19, TypeScript, Tailwind CSS, and Postgres.

## Architecture

- **Framework**: TanStack Start (SSR) + Vite 8 + Nitro server
- **UI**: React, Tailwind CSS v4, shadcn/ui (New York style), Framer Motion
- **Database**: Dual backend — Supabase cloud OR local Postgres (auto-detected via env vars)
- **Auth**: Custom HMAC-SHA256 session tokens with JTI revocation (not Supabase Auth)
- **Chat**: mimo-v2.5 via OpenCode Go
- **Testing**: Playwright (E2E), bun:test (unit)

## Key Directories

```
src/
  routes/           File-based routing (TanStack Router)
  components/       React components
    ui/             shadcn/ui components (~20 active)
    ui-elements.tsx Shared UI primitives (Badge, Card, Modal, Field, Toggle, etc.)
    courses/        Course management sub-components (wizard, modals, sections)
    sidebar.tsx     AppShell, navigation, sidebar
  hooks/            Custom React hooks (useProfile, useTheme, useRfidScanner)
  lib/              Utilities and business logic
    server/         Server-only domain modules (decomposed from lms.server.ts)
    lms.ts          Client API layer (server function wrappers)
    lms.functions.ts TanStack Start server functions (RPC)
  integrations/
    db/             Database client (pg Pool + Supabase fallback)
    supabase/       Legacy shims (backward compat)
supabase/migrations/ SQL migrations (24 files)
scripts/            DB migration and utility scripts
tests/e2e/          Playwright E2E tests
```

## Commands

```sh
bun run dev          # Start dev server on http://127.0.0.1:3000
bun run build        # Production build
bun run lint         # ESLint
bun run typecheck    # TypeScript type checking
bun run test         # Unit tests (bun:test)
bun run test:e2e     # Playwright E2E tests
bun run db:up        # Start Postgres via Docker
bun run db:migrate   # Run SQL migrations
bun run db:reset     # Teardown + recreate + migrate
```

## Code Conventions

- Server-only files use `.server.ts` suffix
- All DB access goes through `src/lib/server/` domain modules
- Server functions in `lms.functions.ts` wrap server logic with input validation
- Client code imports from `@/lib/lms` (the RPC layer), never directly from server modules
- Use `cn()` from `@/lib/utils` for className merging (clsx + tailwind-merge)
- Zod schemas in `src/lib/server/schemas.server.ts` validate all inputs

## Database

- 16 tables with RLS enabled (default-deny)
- Migrations in `supabase/migrations/` — run via `bun run db:migrate`
- Local Postgres via Docker: `bun run db:up`

## Security

- SESSION_SECRET env var required (no fallback to Supabase service key)
- HMAC-SHA256 session tokens with JTI revocation
- Configurable session TTL via SESSION_TTL_MS env var (default 12h)
- bcrypt-hashed PINs (legacy plaintext auto-upgraded on login)
- Rate limiting: 5 attempts per 15 minutes
- CSP headers with Google APIs whitelisted
- Path traversal prevention in storage layer
