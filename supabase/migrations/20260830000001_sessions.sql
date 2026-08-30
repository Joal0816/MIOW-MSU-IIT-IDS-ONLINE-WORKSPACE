-- Sessions: HMAC jti revocation table (Phase 1 security)
-- Each issued session token carries a jti (JWT ID) that is persisted here
-- so logout / password reset / role change can revoke it.

create table if not exists public.sessions (
  jti uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

alter table public.sessions enable row level security;

-- Service role bypasses RLS (server-only data layer in lms.server.ts)
grant all on public.sessions to service_role;

-- No anon/authenticated grants and no public policy => anon cannot read sessions
-- (defense in depth: even if anon key leaks, sessions are invisible)

-- Fast lookup for active sessions of a profile (revocation check in requireSession)
create index if not exists sessions_profile_expires_idx
  on public.sessions (profile_id, expires_at)
  where revoked_at is null;
