# MIOW — Combined Security + G7-College Feature Enhancements (Brand: MIOW Retained)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Deliver a hardened, G7-to-College-ready **MIOW (MSU-IIT IDS ONLINE WORKSPACE)** — fix critical/high/medium security gaps (session secret isolation, jti revocation, RLS defense-in-depth, hardware/avatar/material hardening, brute-force & upload validation, async bcrypt, MCP & chat auth, security headers), remove ALL Lovable references, retain MIOW brand, deliver pedagogical renames (Assignment → Activity), G7-College course model (JHS/SHS/College), Google Docs manual worksheets, drag-drop uploads, teacher-gated score/answer-key release, long-term AI chatbot memory, and optional facial recognition — with zero regressions and single-source MIOW brand.

**Architecture:** Retain **MIOW** via `src/lib/brand.ts` (single source of truth; `APP_NAME`, `APP_SHORT_NAME`, `NOTIFICATION_SIGNOFF` remain MIOW). TanStack Start (Vite + Nitro) server functions (`src/lib/lms.server.ts` / `src/lib/lms.functions.ts`) remain the sole auth boundary, using service_role admin client (`src/integrations/supabase/client.server.ts`) as server-only data layer with **DB RLS as second line** (drop `Public demo access using (true)` policies). Short-lived HMAC tokens move to dedicated `SESSION_SECRET` + jti-backed `sessions` table checked in `requireSession` (`src/lib/lms.server.ts:82-87`). Public routes (`api/public/avatar.ts`, `api/public/material.ts`, `api/public/hardware/*`) tightened via strict allowlists, header-based auth, timestamp/replay protection, and mime sniffing. AI Gateway (`src/lib/ai-gateway.server.ts` renamed from Lovable gateway) + `chat-tools.server.ts` + `chat-memory.server.ts` provide chatbot with Supabase-backed memory. New tables: `sessions` (jti), `chat_memories`, `announcement_attachments`, `submission_files`, `course` level cols (`education_level`/`strand`/`program`), `score_released` flags. Google Docs: Picker API + Drive export → `worksheet-parser.ts`. Facial rec: face-api.js / onnx pre-trained, client embedding + server verify, flagged off. All verified via graph coverage (`no_recorded_issue` on 10 critical files, 14 `parse_partial` best-effort) + grep for missing guards.

**Tech Stack:** TanStack Start (Vite 8, Nitro), React 19, Bun, Supabase JS 2.112.3 (Postgres + Storage + RLS), TanStack Query 5, Tailwind 4, shadcn/ui, bcryptjs 3.0.3, node:crypto HMAC/timingSafeEqual, zod, AI SDK 7 (AI Gateway), Google Picker + Drive API, optional face-api.js (`@vladmandic/face-api`).

---

## Current Context / Assumptions

- **Index:** `C-Users-kent-Documents-lmslatest`, 1726 nodes / 5360 edges, full mode `2026-08-30T14:24:42Z`. Coverage: `skipped 0`, 14 `parse_partial` (3 settings.tsx `774/1064/360/621/402` + 10 migrations SQL dialect), 4 `not_indexed` by design (`.env`, `public/*.svg/jpg`). Core `src/lib/integrations/routes/components` verified.
- **Hotspots:** `cn` 162, `sessionToken` 55, `unwrap` 42 (1130 CALLS). Cluster 0 (100 members, cohesion 0.993) is auth core. No cycles, layers `routes->lib 198` calls.
- **Brand:** App is **MIOW (MSU-IIT IDS ONLINE WORKSPACE)** via `src/lib/brand.ts:5-26` (`APP_NAME`, `APP_SHORT_NAME`, `NOTIFICATION_SIGNOFF`) and `src/components/brand.tsx` (MiowMark/MiowWordmark). `src/routes/__root.tsx:81` title is MIOW. **Keep as-is** — G7-College denotes grade coverage 7→College, not a rebrand. `public/miow-logo.svg` remains canonical.
- **Critical Security Finding:** `sessionSecret()` (`lms.server.ts:48-52`) returns `SUPABASE_SERVICE_ROLE_KEY` — HMAC key = DB admin key. `createSessionToken` 54-60 / `verifySessionToken` 62-79 forgeable if leaked; `requireSession` has no revocation. RLS is `enable row level security` + `Public demo access using (true) with check (true)` for `anon,authenticated` on all 10 tables (migration `20260822144314:22-149` grants `select/insert/update/delete` to `anon,authenticated` + policy `true`) — effectively open if anon key exposed. Service_role bypass is intentional per header `lms.server.ts:2-6` but needs RLS mirror.
- **Public Surfaces:** `api/public/avatar.ts:19-37` public GET, `api/public/material.ts:21-45` token via `?t=` query, `api/public/hardware/attendance.ts:29-36/41-68` and `sync-users.ts:10-18` `timingSafeEqual` on `HARDWARE_API_KEY`, MCP `resolveCaller` `21-47` via `ilike email`, PIN legacy plaintext upgrade `verifyPin` `513-531` sync bcrypt, `unwrap` `22-38` leaks PostgREST detail.
- **Assignment Model:** `assignments` table + `submissions` + `quizzes`/`quiz_questions` separate. Need pedagogical rename Assignments → Activities/Worksheets — keep DB `assignments` with comment, alias types.
- **NOTIFICATION_SIGNOFF** ready but unused — no email/push pipeline. Add `src/lib/notifications.ts` stub.
- **Manual Worksheet via Google Docs:** `src/lib/worksheet-parser.ts` parses 4-section text; `src/routes/dashboard.admin.courses.tsx:59k` + `worksheet-context.ts` generates via AI. Need "Import from Google Docs" path.
- **Courses:** `src/routes/dashboard.admin.courses.tsx` (CoursesPage) has `grade_level`, `color`, `days/schedule`, `teacher_id`. G7-COLLEGE means `grade_level` 7-12 + college year 1-4, not just "10".
- **Teachers Dashboard Menu:** `src/components/lms.tsx: staffNav` + `dashboard.admin.*` routes. Needs "Students Info" quick list.
- **Announcements:** `src/routes/dashboard.admin.announcements.tsx` (277 lines, simple form) — needs drag-drop attachments.
- **AI Chatbot:** `src/components/chat-widget.tsx` (localStorage history) + `src/lib/chat-tools.server.ts` + `src/lib/ai-gateway.server.ts` (Lovable AI Gateway). No cross-session memory beyond localStorage; server tools stateless.
- **Student Dashboards:** `dashboard.student.quizzes.tsx` (19k, shows score instantly via `SubmitQuizResult`), `dashboard.student.assignments.tsx` (340 lines, has drag but not full worksheet upload), `dashboard.student.index.tsx` filtered by `grade_level`. Requirement: hide score until teacher releases answer key.
- **Facial Recog Optional:** `profiles` has `face_embedding text`; no enrollment/verify flow except `enrollBiometrics` stub.
- **Lovable References:** ~15 hits (`vite.config.ts` `@lovable.dev/vite-tanstack-config`, `src/lib/lovable-error-reporting.ts`, `src/integrations/supabase/client.ts` `lovable-preview-auth` broker, `auth-middleware.ts`/`client.server.ts` `"Connect Supabase in Lovable Cloud."`, `package.json` `@lovable.dev/*`, `src/lib/ai-gateway.server.ts` `createLovableAiGatewayProvider`, `supabase/config.toml`, `README.md`, `AGENTS.md`).
- **Assumptions:** `.env` not indexed (gitignore) — contains `SUPABASE_URL`, `SERVICE_ROLE`, `PUBLISHABLE`, `HARDWARE_API_KEY`; client never imports `lms.server.ts` (eslint); Supabase Auth still used for dashboard + OAuth; `.env` correctly ignored (`!! .env`).

## Proposed Approach

**Phased, additive, backward-compatible — security first, then features — each task TDD (failing test → minimal fix → pass → commit), `bun run lint && bun run build` green after every task, `grep`/`check_index_coverage` verified.**

1. **Phase 0 — Brand & Hygiene (no behavior break, unlocks rest):** Confirm MIOW single source (verify, no rename), remove ALL Lovable references exhaustive (`grep -Rin lovable` → 0).
2. **Phase 1 — Critical Security:** Dedicated `SESSION_SECRET` (compat read), jti-backed `sessions` table + revocation, RLS lockdown (drop `Public demo access`), sanitize `unwrap`.
3. **Phase 2 — High Security:** Hardware timestamp/replay, avatar entropy + optional auth, material header auth, mime sniff, brute-force rate limit.
4. **Phase 3 — Medium Security + Hardening:** Async bcrypt, MCP `email_verified`, chat auth + CSP/HSTS.
5. **Phase 4 — Feature Foundation:** Pedagogical rename (Assignment→Activity type alias, DB stays), notification stub, G7-College course model (JHS/SHS/College).
6. **Phase 5 — Feature UX:** G7-College creation wizard, teacher Students Info + menus, announcement dropzone, chat long-term memory, score gating, worksheet file uploads, dashboard polish, Google Docs import, optional facial rec (flagged off).

DRY: extract `Dropzone` (`src/components/dropzone.tsx`), `releaseToggle`, `rate-limit` helper, `brand()` helper. YAGNI: no full SIS rebuild, no grading rewrite.

---

## Step-by-Step Plan

### Task 1 — Confirm MIOW brand (retain, no rebrand)

**Objective:** Keep MIOW single source; verify no hardcodes or accidental G7-College brand leakage.

**Files:**
- Verify (no change): `src/lib/brand.ts:5-26` stays `APP_NAME="MSU-IIT IDS ONLINE WORKSPACE (MIOW)"`, `APP_SHORT_NAME="MIOW"`, `NOTIFICATION_SIGNOFF="Sincerely,\nThe MIOW Administration Team"`
- Verify: `src/components/brand.tsx:44-91` (MiowMark/MiowWordmark still MIOW)
- Verify: `src/routes/__root.tsx:76-89` (title/meta still `MIOW - MSU-IIT IDS Online Workspace`)
- Verify: `public/miow-logo.svg` remains canonical (no `/g7-logo.svg` switch)
- Search: `grep -rn "G7-College.*LMS\|G7-COLLEGE" src --include="*.ts" --include="*.tsx"` must return 0 for brand strings (G7-College only for grade-level feature, not brand)

**Step 1 — Write failing test**
```ts
// tests/brand.test.ts
import { APP_NAME, APP_SHORT_NAME, APP_COMPACT_NAME, NOTIFICATION_SIGNOFF, BRAND_LOGO_SRC } from "@/lib/brand";
expect(APP_NAME).toBe("MSU-IIT IDS ONLINE WORKSPACE (MIOW)");
expect(APP_SHORT_NAME).toBe("MIOW");
expect(APP_COMPACT_NAME).toBe("MSU-IIT IDS");
expect(NOTIFICATION_SIGNOFF).toContain("MIOW Administration Team");
expect(BRAND_LOGO_SRC).toBe("/miow-logo.svg");
```

**Step 2 — Run** `bun run lint && bun run build` — expect pass (brand already MIOW).

**Step 3 — Implement (if needed)**
```ts
// src/lib/brand.ts — keep as-is, do NOT change to G7-College:
export const APP_NAME = "MSU-IIT IDS ONLINE WORKSPACE (MIOW)";
export const APP_SHORT_NAME = "MIOW";
export const APP_COMPACT_NAME = "MSU-IIT IDS";
export const APP_DESCRIPTOR = "MSU-IIT IDS ONLINE WORKSPACE";
export const APP_TAGLINE = "Integrated Development School – Online Workspace";
export const KIOSK_TITLE = "MIOW Attendance Kiosk";
export const KIOSK_EVENT_HEADER = "MIOW ATTENDANCE: MSU-IIT IDS ONLINE WORKSPACE";
export const NOTIFICATION_SIGNOFF = "Sincerely,\nThe MIOW Administration Team";
export const BRAND_LOGO_SRC = "/miow-logo.svg";
```

**Step 4 — Pass + commit** `git commit -m "chore(brand): confirm MIOW retained"`

### Task 2 — Remove ALL Lovable references in code

**Objective:** Delete every `lovable` reference — imports, strings, comments, env prefixes, assets — zero `grep -Rin lovable` hits after (allow only historical note in this plan).

**Files (exhaustive sweep):**
- Delete: `.lovable/` folder (`mcp/manifest.json`, `project.json`) — or keep `.lovable/project.json` only if build requires template, but remove Lovable branding inside
- Modify: `vite.config.ts:1-20` (remove `import lovable from "@lovable.dev/vite-tanstack-config"` and `lovable()` plugin; remove `@lovable.dev/vite-tanstack-config` dep)
- Delete: `src/lib/lovable-error-reporting.ts` (entire file; replace imports with `src/lib/error-reporting.ts` stub or `console.error`)
- Modify: `src/routes/__root.tsx:14` (remove `import { reportLovableError }` and its `ErrorComponent` useEffect)
- Modify: `src/integrations/supabase/client.ts:29-56` (delete `lovable-preview-auth` broker: `brokeredPreviewStorage`, `PREVIEW_ZONES` Lovable hosts, `lovableproject.com`/`gptengineer` checks)
- Modify: `src/integrations/supabase/auth-middleware.ts`, `src/integrations/supabase/client.server.ts`, `src/integrations/supabase/cron-auth.ts` (replace `"Connect Supabase in Lovable Cloud."` → `"Configure Supabase env (SUPABASE_URL / SUPABASE_...)."`; `LOVABLE_CRON_SECRET` → `CRON_SECRET`)
- Modify: `package.json:21,89` (remove `@lovable.dev/mcp-js` and `@lovable.dev/vite-tanstack-config` if present)
- Modify: `src/lib/ai-gateway.server.ts` (rename `createLovableAiGatewayProvider` → `createAiGatewayProvider`, `LOVABLE_AIG_RUN_ID_HEADER` → `AI_GATEWAY_RUN_ID_HEADER`; `LOVABLE_API_KEY` → `AI_GATEWAY_KEY`/`OPENAI_API_KEY`; comments "Lovable AI Gateway" → "AI Gateway")
- Search & clean: `grep -Rin lovable --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md" --include="*.toml"` — fix hits in `supabase/config.toml`, `README.md`, `AGENTS.md`, `.env.example`, `src/lib/mcp/*`, `src/components/*` badge
- Modify: `supabase/config.toml` (remove `[lovable]` section if any)
- Modify: `README.md`, `AGENTS.md` (remove Lovable Cloud instructions)

**Steps:**
1. `grep -Rin lovable` baseline → ~12-15 hits
2. Apply deletions/renames one-by-one (keep `brand.ts` MIOW intact)
3. `grep -Rin lovable --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.hermes` → 0 (only plan history allowed)
4. `bun run lint && bun run build && tsc --noEmit` green

**Commit:** `chore: remove ALL Lovable references in code`

### Task 3 — Env isolation & documentation (Security Phase 0)

**Objective:** Introduce dedicated `SESSION_SECRET` without changing runtime yet.

**Files:**
- Modify: `supabase/config.toml` (if env injection needed)
- Create: `.env.example` (new)
- Modify: `README.md:1-40` (env docs)

**Step 1: Write failing test (script check)**
```ts
// scripts/check-env.test.ts
assert(process.env.SESSION_SECRET !== process.env.SUPABASE_SERVICE_ROLE_KEY)
```
Run: `bun run build` — expect fail (SESSION_SECRET undefined).

**Step 2: Create .env.example**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PUBLISHABLE_KEY=
SESSION_SECRET= # 32+ random hex, generate: openssl rand -hex 32
HARDWARE_API_KEY=
HARDWARE_API_KEY_HASH= # optional hashed
AI_GATEWAY_KEY= # formerly LOVABLE_API_KEY
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_API_KEY=
```

**Step 3: Verify** `cat .env.example` contains 8 keys, no values.

**Commit:** `git add .env.example README.md; git commit -m "chore: isolate session secret env"`

### Task 4 — Migrate session HMAC to SESSION_SECRET (v1 compat read)

**Objective:** Switch HMAC to `SESSION_SECRET` with fallback verification for old tokens.

**Files:**
- Modify: `src/lib/lms.server.ts:48-79` (sessionSecret, verifySessionToken, createSessionToken)
- Test: `src/lib/lms.server.test.ts` (new if absent)

**Step 1: Write failing test**
```ts
process.env.SESSION_SECRET = "test-secret-32-chars-hex-123456";
process.env.SUPABASE_SERVICE_ROLE_KEY = "other-key";
const t = createSessionToken("id-1");
assert(verifySessionToken(t) === "id-1");
assert(() => verifySessionToken(oldTokenSignedWithServiceKey) throws);
```

**Step 2: Run** `bun run build` — expect fail until code updated.

**Step 3: Implement**
```ts
function sessionSecret(): string {
  const key = process.env["SESSION_SECRET"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Missing SESSION_SECRET");
  if (process.env.SESSION_SECRET && key === process.env.SUPABASE_SERVICE_ROLE_KEY) console.warn("[security] SESSION_SECRET equals service key");
  return key;
}
function verifySessionToken(token: string): string {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new Error("Unauthorized");
  const tryKeys = [process.env.SESSION_SECRET, process.env.SUPABASE_SERVICE_ROLE_KEY].filter(Boolean) as string[];
  let ok = false;
  for (const k of tryKeys) {
    const expected = createHmac("sha256", k).update(payload).digest("base64url");
    const a=Buffer.from(sig), b=Buffer.from(expected);
    if (a.length===b.length && timingSafeEqual(a,b)) { ok=true; break; }
  }
  if (!ok) throw new Error("Unauthorized");
  // ... rest unchanged
}
```

**Commit:** `feat: isolate session HMAC to SESSION_SECRET with compat`

### Task 5 — Add sessions table + jti revocation

**Objective:** Make tokens revocable (logout, pin/password reset, role change).

**Files:**
- Create: `supabase/migrations/20260830000001_sessions.sql` (new)
- Modify: `src/lib/lms.server.ts:46,54-87,760-811 deleteUser,705-725 updateProfile`

**Step 1: Migration (up)**
```sql
create table public.sessions (
  jti uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  ip text, user_agent text
);
alter table public.sessions enable row level security;
grant all on public.sessions to service_role;
-- no anon policy
create index on public.sessions(profile_id, expires_at) where revoked_at is null;
```

**Step 2: Code — issue jti**
```ts
export function createSessionToken(profileId: string, jti = crypto.randomUUID()): string {
  const payload = Buffer.from(JSON.stringify({ sub: profileId, jti, exp: Date.now()+SESSION_TTL_MS })).toString("base64url");
  void db.from("sessions").insert({ jti, profile_id: profileId, expires_at: new Date(Date.now()+SESSION_TTL_MS).toISOString() });
  // ... hmac
}
export async function requireSession(token: string) {
  const id = verifySessionToken(token); // extracts jti from payload
  const row = await unwrap(db.from("sessions").select("revoked_at, expires_at").eq("jti", jti).maybeSingle());
  if (!row || row.revoked_at) throw new Error("Unauthorized");
  // ... getProfileById
}
```

**Step 3: Test** `verifySessionToken` + revoked throws.

**Step 4:** `bun run build` + `npx supabase db push --dry-run` syntax check

**Commit:** `feat: jti sessions with revocation`

### Task 6 — Harden RLS — drop public demo policies

**Objective:** Replace `Public demo access using (true)` with locked-down policies.

**Files:**
- Create: `supabase/migrations/20260830000002_lock_rls.sql`
- Verify: `supabase/migrations/20260822144314*` lines 22-149 each table

**Step 1: Migration**
```sql
-- for each table: profiles, announcements, courses, enrollments, assignments, submissions, quizzes, quiz_questions, grades, attendance_logs, sessions
drop policy if exists "Public demo access" on public.profiles;
revoke select, insert, update, delete on public.profiles from anon, authenticated;
grant select, insert, update, delete on public.profiles to anon, authenticated; -- keep grant but no policy => deny
-- service_role bypasses RLS, so server still works
create policy "own profile" on public.profiles for select to authenticated using (auth.uid() = id);
-- repeat for other tables; for student-visible tables add scoped policies or keep service_role-only and rely on server
```

**Step 2: Test** anon query via publishable key → 0 rows.

**Step 3: Verify** app still works via service_role (`unwrap` paths).

**Commit:** `feat: lock RLS — drop public demo policies`

### Task 7 — Sanitize unwrap error leakage

**Objective:** Stop leaking PostgREST code/detail to client.

**Files:**
- Modify: `src/lib/lms.server.ts:22-38`

**Implement**
```ts
console.error("[lms] database error:", { code: error.code, message: error.message });
throw new Error("Database request failed");
```

**Commit:** `fix: sanitize unwrap error leakage`

### Task 8 — Hardware auth hardening (timestamp HMAC)

**Objective:** Add timestamp + replay protection to hardware endpoints.

**Files:**
- Modify: `src/routes/api/public/hardware/attendance.ts:29-36,41-68`
- Modify: `src/routes/api/public/hardware/sync-users.ts:10-18,23-30`
- Modify: `.env.example`

**Implement authorized(request):**
```ts
function authorized(request: Request): boolean {
  const expected = process.env.HARDWARE_API_KEY;
  if (!expected) return false;
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i,"");
  const ts = request.headers.get("x-hardware-timestamp");
  if (!ts || Math.abs(Date.now() - Date.parse(ts)) > 5*60*1000) return false;
  const a=Buffer.from(token), b=Buffer.from(expected);
  return a.length===b.length && timingSafeEqual(a,b);
}
```
Add rate limit 60/min per IP.

**Commit:** `feat: hardware timestamp replay protection`

### Task 9 — Fix avatar privacy + entropy

**Objective:** Require auth or increase rand to 128-bit; add magic-byte check.

**Files:**
- Modify: `src/lib/lms.server.ts:836-865 uploadAvatar` (rand 32 hex → 64 hex)
- Modify: `src/routes/api/public/avatar.ts:19-37 GET` (add optional auth for private)
- Modify: `src/routes/api/public/avatar.ts: PATH_RE` strict check

**Implement**
```ts
const rand = createHmac("sha256", sessionSecret()).update(`${caller.id}:${Date.now()}:${crypto.randomUUID()}`).digest("hex").slice(0,16); // 64-bit
// + file-type sniff: if !["image/png","image/jpeg","image/webp","image/gif"].includes(detected) throw
```

**Commit:** `feat: avatar entropy + privacy`

### Task 10 — Move material token from query to header

**Objective:** Prevent token leakage in logs.

**Files:**
- Modify: `src/routes/api/public/material.ts:21-45`
- Modify: `src/lib/lms.ts:899-901 materialHref` (client helper)

**Implement**
```ts
const t = request.headers.get("authorization")?.replace(/^Bearer\s+/i,"") ?? url.searchParams.get("t") ?? "";
try { await server.requireSession(t); } catch { return new Response("Unauthorized", {status:401}); }
```

**Commit:** `feat: material token via header`

### Task 11 — Upload validation — mime sniff + size

**Objective:** Validate file signatures, not just contentType header.

**Files:**
- Modify: `src/lib/lms.server.ts:836-865,1866-1896` (uploadAvatar, uploadCourseMaterial)
- Add dep if needed: `file-type` (check package.json, add if missing)

**Implement**
```ts
import { fileTypeFromBuffer } from "file-type";
const detected = await fileTypeFromBuffer(buffer);
if (!detected || !ALLOWED_MIMES.has(detected.mime)) throw new Error("Unsupported image type");
```

**Commit:** `feat: mime sniff upload validation`

### Task 12 — Brute-force rate limit on PIN/login

**Objective:** Limit PIN/password attempts.

**Files:**
- Modify: `src/lib/lms.server.ts:513-554 verifyPin/verifySecret, 556-621 verifyPinLogin`
- Create: `src/lib/rate-limit.ts` (new, in-memory or Supabase-based)

**Implement**
```ts
const bucket = getBucket(`login:${p.id}`); // 5 attempts / 15 min
if (!bucket.consume()) throw new Error("Too many attempts");
```

**Commit:** `feat: login rate limit`

### Task 13 — Switch bcrypt sync -> async

**Objective:** Avoid event-loop blocking.

**Files:**
- Modify: `src/lib/lms.server.ts:516,522,526,548` (compareSync/hashSync → compare/hash async)

**Implement**
```ts
await bcrypt.compare(pin, p.pin_hash)
await bcrypt.hash(pin, 10)
```

**Commit:** `perf: async bcrypt`

### Task 14 — MCP caller hardening (email_verified)

**Objective:** Ensure OAuth email is verified before matching profile.

**Files:**
- Modify: `src/lib/mcp/helpers.ts:21-47 resolveCaller`
- Modify: `src/integrations/supabase/auth-middleware.ts:33-109 requireSupabaseAuth` context

**Implement**
```ts
if (!ctx.getUser()?.email_verified) return { ok:false, message:"Verify your email first" };
```

**Commit:** `fix: MCP email_verified check`

### Task 15 — Chat route auth + security headers

**Objective:** Ensure `api/chat.ts:30-83 POST` checks `requireSession`, add CSP/HSTS.

**Files:**
- Modify: `src/routes/api/chat.ts:15-25,30-83`
- Modify: `src/server.ts:1-30`, `vite.config.ts:1-20`

**Implement**
```ts
await requireSession(getHeader("authorization"))
// server.ts add headers middleware: CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy
```

**Commit:** `feat: chat auth + security headers`

### Task 16 — Rename Assignment → Activity (UI label, type alias, keep DB)

**Objective:** Teacher/student see "Activity / Worksheet / Assessment" not generic "Assignment"; DB stays `assignments`.

**Files:**
- Modify: `src/integrations/supabase/types.ts:58` (add comment alias)
- Create: `src/lib/domain-labels.ts` (Activity labels)
- Modify: `src/lib/lms.ts:32-80` (type alias `export type Activity = Assignment`)
- Modify: `src/components/lms.tsx:348 STUDENT_NAV`, `staffNav` labels
- Modify: `src/routes/dashboard.student.assignments.tsx:34-44` title/content
- Modify: `src/routes/dashboard.admin.courses.tsx` `COMPONENT_LABELS`, tabs, `createAssignment` wrapper `createActivity`
- Modify: `src/components/chat-widget.tsx:54` prompts
- Modify: `src/lib/chat-tools.server.ts:175` tool description

**Implementation:**
```ts
// src/lib/domain-labels.ts
export const LABEL_ASSIGNMENT = "Activity";
export const LABEL_ASSIGNMENTS = "Activities";
export const LABEL_QUIZ = "Worksheet";
// use in UI: `${LABEL_ASSIGNMENTS} | MIOW`
// Keep DB: table `assignments` unchanged; add comment: -- pedagogical label: Activity
```

**Commit:** `feat(domain): rename Assignment -> Activity (DB stays assignments)`

### Task 17 — Notification pipeline stub (sign-off ready)

**Objective:** Make `NOTIFICATION_SIGNOFF` usable; stub that logs until email added.

**Files:**
- Create: `src/lib/notifications.ts`
- Modify: `src/lib/brand.ts` (export signoff already)
- Modify: `src/routes/dashboard.admin.announcements.tsx` (call notify on create)

**Implement:**
```ts
// src/lib/notifications.ts
import { NOTIFICATION_SIGNOFF } from "./brand";
export async function notifyAnnouncement(a: Announcement) {
  console.log(`[notify] ${a.title}\n${NOTIFICATION_SIGNOFF}`);
  return { queued: false, reason: "no pipeline" };
}
```

**Commit:** `feat(notify): stub notification pipeline`

### Task 18 — G7-COLLEGE course model (JHS/SHS/College)

**Objective:** Courses span G7-12 + College 1-4 with level-aware filtering.

**Files:**
- Create: `supabase/migrations/20260831_g7_college_courses.sql`
- Modify: `src/lib/lms.server.ts:320` (schemas courseInput)
- Modify: `src/routes/dashboard.admin.courses.tsx:55-77` (EMPTY_COURSE, grade_level select)
- Modify: `src/routes/dashboard.student.index.tsx:65` filter

**Migration:**
```sql
alter table public.courses add column if not exists education_level text check (education_level in ('jhs','shs','college')) default 'jhs';
alter table public.courses add column if not exists strand text;
alter table public.courses add column if not exists program text;
-- grade_level 7-12 for jhs/shs, 13-16 for college Yr1-4
```

**UI:** Segmented control: JHS (7-10) | SHS (11-12 + strand) | College (Yr1-4 + program). `EMPTY_COURSE.grade_level` becomes 7-16.

**Commit:** `feat(courses): G7-College course levels`

### Task 19 — Admin & Teachers Dashboard: G7-COLLEGE course creation (UX)

**Objective:** Polished creation wizard with grade/level, strand/program, color, schedule, teacher assign.

**Files:**
- Modify: `src/routes/dashboard.admin.courses.tsx:102-600` (CoursesPage form, POLICY_LABELS, COLORS)
- Modify: `src/components/lms.tsx` AppShell + staffNav

**Steps:** Stepper: 1) Basic (title/code/level) 2) Assignment (teacher, strand/program) 3) Schedule (days/start/end/grace). Validate `grade_level` matches `education_level`. Preview via `courseStyle`.

**Commit:** `feat(courses): G7-College creation wizard`

### Task 20 — Teachers Dashboard: Students Info + Dashboard menu

**Objective:** Teacher quick view of roster, per-student grades/attendance.

**Files:**
- Modify: `src/routes/dashboard.admin.students.tsx` / `dashboard.admin.teachers.tsx`
- Create: `src/routes/dashboard.teacher.students.tsx` (or reuse admin students with role gate)
- Modify: `src/components/lms.tsx` (teacher nav: Dashboard, Students, Courses, Announcements, Grades, Attendance)
- Modify: `src/lib/lms.server.ts` `listStudents` already exists, add `getStudentInfo` aggregation

**Implement:** Dashboard index cards: My Courses, My Students, Pending Activities, Recent Submissions. Students Info table: name, grade/section, student_id, attendance %, avg grade. Search + grade filter.

**Commit:** `feat(teacher): students info + dashboard menu`

### Task 21 — Announcements drag-and-drop file uploads

**Objective:** Attach files to announcements via dropzone.

**Files:**
- Create: `supabase/migrations/20260831_announcement_attachments.sql` (table + bucket)
- Modify: `src/routes/dashboard.admin.announcements.tsx:29-277` (form + drag state)
- Modify: `src/lib/lms.server.ts` + `lms.functions.ts` + `lms.ts` (create/update/list attachments)
- Modify: `src/components/lms.tsx` (render attachments)
- Reuse: drag logic from `dashboard.student.assignments.tsx:55` and `PendingDropzone`

**Migration:**
```sql
create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements(id) on delete cascade,
  file_url text not null, file_name text, file_size int, mime text, created_at timestamptz default now()
);
```

**Commit:** `feat(announcements): drag-drop attachments`

### Task 22 — AI Chatbot: Memories for past activities

**Objective:** Chat remembers past queries across sessions.

**Files:**
- Create: `supabase/migrations/20260831_chat_memories.sql`
- Modify: `src/lib/chat-tools.server.ts:23-315` (systemPromptFor)
- Modify: `src/components/chat-widget.tsx:91` (loadHistory)
- Create: `src/lib/chat-memory.server.ts` (summarize + store)

**Migration:**
```sql
create table public.chat_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  summary text not null,
  last_n_messages jsonb,
  created_at timestamptz default now(), updated_at timestamptz
);
```

**Flow:** On each `api/chat` POST, summarize last 20 messages and upsert. `systemPromptFor` injects `Past context: ${memory.summary}`. Client hydrates from server if localStorage empty.

**Commit:** `feat(chat): long-term memories`

### Task 23 — Students Dashboard: hide score until teacher releases

**Objective:** Teacher controls `score_released` / `answer_key_released`; student sees "Awaiting release" otherwise.

**Files:**
- Create: `supabase/migrations/20260831_score_release.sql`
- Modify: `src/lib/lms.server.ts` (quiz_attempts + submissions, `submitQuizAttempt`, `scoreQuiz`)
- Modify: `src/routes/dashboard.student.quizzes.tsx:1-100` (result rendering)
- Modify: `src/routes/dashboard.admin.courses.tsx` (teacher toggles saveQuizEdit)

**Migration:**
```sql
alter table public.quizzes add column if not exists score_released boolean default false;
alter table public.quizzes add column if not exists answer_key_released boolean default false;
alter table public.assignments add column if not exists score_released boolean default false;
alter table public.quiz_attempts add column if not exists released boolean default false;
```

**Server:** `submitQuizAttempt` returns `{ ok:true, score: null, pendingRelease:true }` when not released.

**Student UI (`quizzes.tsx:39-80`):**
```tsx
{result && !activeQuiz.score_released ? (
  <Card>Awaiting teacher release — submitted {fmtDate(result.submitted_at)}</Card>
) : (
  <Score score={result.score} answerKey={activeQuiz.answer_key_released ? questions : undefined} />
)}
```

**Commit:** `feat(worksheets): teacher-gated score release`

### Task 24 — Worksheet: student upload files (drag-and-drop)

**Objective:** Students submit worksheets as file uploads, not just answers.

**Files:**
- Create: `supabase/migrations/20260831_worksheet_uploads.sql`
- Modify: `src/routes/dashboard.student.quizzes.tsx` (add Upload tab)
- Modify: `src/routes/dashboard.student.assignments.tsx` (extend drag)
- Modify: `src/lib/lms.server.ts` + `lms.functions.ts` + `lms.ts` (submitAssignmentFile)
- Reuse: `formatFileSize`, `CloudUpload` dropzone → extract `src/components/dropzone.tsx`

**Migration:**
```sql
create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  file_url text, file_name text, mime text
);
```

**Commit:** `feat(worksheets): student file upload drag-drop`

### Task 25 — Dashboard menus (Student + Teacher) polish

**Objective:** Consistent AppShell nav, breadcrumbs, G7-College grouping.

**Files:**
- Modify: `src/components/lms.tsx` (STUDENT_NAV, staffNav, AppShell sidebar)
- Modify: `src/routes/dashboard.student.index.tsx:1-65`, `dashboard.student.tsx`
- Modify: `src/routes/dashboard.admin.index.tsx`, `dashboard.admin.tsx`, teacher routes

**Nav:**
- Student: Dashboard | Activities | Worksheets | Grades | Attendance | Announcements
- Teacher: Dashboard | Students Info | Courses (G7-COLLEGE) | Worksheets | Announcements | Grades | Attendance
- Admin: all + Settings, Teachers

Add `useProfile` gate. Ensure `pageTitle()` uses **MIOW** via `src/lib/brand.ts`.

**Commit:** `feat(nav): MIOW dashboard menus with G7-College grouping`

### Task 26 — Manual worksheet: Google Docs integration

**Objective:** Import worksheet from Google Doc, parse via `worksheet-parser`, create quiz/assignment.

**Files:**
- Modify: `src/lib/worksheet-parser.ts:1-75` (accept Docs export HTML)
- Modify: `src/routes/dashboard.admin.courses.tsx` (Add "Import from Google Docs" button)
- Create: `src/lib/google-docs.ts` (Picker + Drive export helper)
- Modify: `src/lib/worksheet-context.ts:18-20` (include doc link)
- Env: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`

**Flow:**
1. Teacher clicks "Import from Google Docs" → Google Picker (gapi) → pick document → fetch export via `https://www.googleapis.com/drive/v3/files/{id}/export?mimeType=text/markdown`
2. Client sends markdown to `parseWorksheet(markdown)` (handles `clean()` line 44).
3. Preview (questions count, dropped) → confirm → `createQuizWithQuestions` / `createAssignment`.
4. Store `google_doc_id` + `url` on quiz metadata.

**Fallback:** paste share link → server fetches via Drive API.

**Commit:** `feat(worksheets): Google Docs import`

### Task 27 — Optional: Working facial recognition (pre-trained) [STRETCH]

**Objective:** Face enrollment + verification using pre-trained model; flagged off.

**Files:**
- Create: `src/lib/face-recognition.ts` (client wrapper)
- Modify: `src/routes/dashboard.admin.students.tsx` / `dashboard.teacher.settings.tsx` (Enroll Face button)
- Modify: `src/lib/lms.server.ts` `enrollBiometrics` (store embedding)
- Modify: `src/integrations/supabase/types.ts` profiles face_embedding
- Add dep: `@vladmandic/face-api` or `face-api.js`
- Create: `src/routes/kiosk.face-verify.tsx` (kiosk verify screen)

**Approach:**
- Client loads models from `/public/models`.
- Enroll: capture video → detect → 128-d embedding → POST to `enrollBiometricsFn` → store Base64.
- Verify: kiosk captures → embedding → server `supabase.rpc('match_face', {embedding})` or JS cosine distance threshold 0.6.
- Privacy: embeddings only; consent toggle; gate behind `face_recognition_enabled` setting.

**Flag:** `VITE_FACE_ENABLED=false` by default. Do NOT block release.

**Commit:** `feat(optional): face recognition scaffolding (flagged off)`

---

## Tests / Validation

- **Unit:** `brand.test.ts` (MIOW retained), `domain-labels.test.ts` (Activity label), `notifications.test.ts` (stub), `lms.server.test.ts` (sessionSecret isolation, jti revocation, unwrap sanitization, bcrypt async, rate-limit), `parseWorksheet` Google Docs export, `score release` (submit → hidden until released), `chat memory` (summary injection)
- **Component:** Dropzone (drag over, drop 2 files, `formatFileSize`), Course wizard (JHS 7 → SHS 12 → College Yr1), Announcements attachments, Students Info table, score gating render
- **Integration:** `bun run build` must stay green after each task; `bun run lint`; `tsc --noEmit`; Supabase migrations `supabase db push --dry-run`; manual: create G7 course → student sees in dashboard → teacher creates worksheet via Google Docs import → student submits file drag-drop → teacher releases score → student sees score; anon query via publishable key → 0 rows after RLS lock; hardware without timestamp → 401; 6th PIN attempt → 429; chat unauth → 401
- **Search Verification:** `grep -Rin lovable --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.hermes` → 0 after Task 2 (only plan history allowed); `grep -rn "MIOW" src` should remain positive (brand retained); `grep -rn "Assignment" src --include="*.tsx"` → only comments/DB; `grep -R "SUPABASE_SERVICE_ROLE_KEY" src --exclude-dir=node_modules` → only `client.server.ts` + `sessionSecret` fallback
- **Security Graph Check:** after each security task, `check_index_coverage` on modified files (expect `no_recorded_issue` or `parse_partial` on migrations), `search_graph query=requireSession` fan_in stays 11+ but callers verified via `trace_path` depth 3; `query_graph` for complexity < 30
- **Manual Security:** attempt public avatar guess, material without token, hardware replay, PIN brute force

## Risks, Tradeoffs, Open Questions

- **Risk:** Renaming Assignment → Activity touches 30+ UI strings but DB stays `assignments` — old API `listAssignments` kept as alias; cache keys still `assignments` — document in README.
- **Tradeoff:** G7-College `grade_level` 7-16 vs current 10 only — old data `grade_level` 10 stays valid; need backfill `education_level='jhs'` for existing rows.
- **Tradeoff:** Google Picker requires Google Cloud project + OAuth consent + Drive scope — provide env template + fallback manual paste import if keys missing.
- **Risk:** Score gating changes student expectation ("see your score instantly" in `quizzes.tsx:32` meta) — update copy to "submitted, awaiting release".
- **Risk:** Lovable AI Gateway removal → chat break — gateway fully renamed to generic `AI_GATEWAY_KEY`/`OPENAI_*`; verify `ai-gateway.server.ts` rename compiles; no Lovable import remains.
- **Risk:** Dropping `Public demo access` RLS breaks demo data — mitigated by keeping `service_role` path; coordinate with env; `SESSION_SECRET` rotation requires mass logout (dual-verify window 1 TTL).
- **Tradeoff:** jti table adds write per login — acceptable vs revocation; could use Redis if scale.
- **Tradeoff:** Making avatars private breaks existing public OG images (`public/og-cover.jpg`) — keep og-cover public, avatars private.
- **Risk:** Migration `20260830000002_lock_rls` not reversible without downtime — test on staging, backup; `unwrap` sanitization hides details — ensure server logs retain code for debugging.
- **Open:** `NOTIFICATION_SIGNOFF` ready but unused — Task 17 stub does not send email; when pipeline added, inject `NOTIFICATION_SIGNOFF` into email footer centrally.
- **Open:** Facial recognition accuracy vs lighting — keep optional, behind flag, fallback to PIN; biometric enrollment needs explicit consent per DepEd.
- **Open:** Hardware timestamp requires device clock NTP — 5-min window chosen; `X-Hardware-Timestamp` header required.
- **Open:** Rate-limit store — in-memory (lost on restart) vs DB table `login_attempts` — start with in-memory + Supabase fallback.
- **YAGNI:** Do not add full SIS (enrollment payments) — keep `enrollStudent` as is; do not rebuild grading; reuse `formatFileSize`/`Dropzone` extract.

## File Change Summary

- **Modify (Security + Brand):** `src/lib/brand.ts` (verify MIOW retained), `src/components/brand.tsx` (verify), `src/routes/__root.tsx` (verify + remove `reportLovableError`), `vite.config.ts` (remove `lovable()`), `src/integrations/supabase/client.ts` (remove `lovable-preview-auth` broker, `PREVIEW_ZONES`), `src/integrations/supabase/client.server.ts:32-56`, `src/integrations/supabase/auth-middleware.ts:33-109`, `src/integrations/supabase/cron-auth.ts`, `src/lib/lovable-error-reporting.ts` (delete), `src/lib/ai-gateway.server.ts` (rename Lovable → generic), `package.json`, `supabase/config.toml`, `README.md`, `AGENTS.md`, `src/lib/lms.server.ts` (48-87,22-38,513-621,836-865,1866-1896), `src/lib/mcp/helpers.ts:21-47`, `src/routes/api/public/avatar.ts:19-37`, `src/routes/api/public/material.ts:21-45`, `src/routes/api/public/hardware/attendance.ts:29-68`, `src/routes/api/public/hardware/sync-users.ts:10-30`, `src/routes/api/chat.ts:15-83`, `src/server.ts`, `.env.example` (new)
- **Modify (Features):** `src/lib/lms.ts` (Activities alias), `src/integrations/supabase/types.ts` (comment), `src/components/lms.tsx` (nav + AppShell), `src/routes/dashboard.admin.courses.tsx` (wizard + G7 levels), `src/routes/dashboard.admin.announcements.tsx` (dropzone), `src/routes/dashboard.admin.students.tsx`, `src/routes/dashboard.student.assignments.tsx` (drag), `src/routes/dashboard.student.quizzes.tsx` (gift + upload), `src/routes/dashboard.student.index.tsx` (filter), `src/routes/dashboard.admin.index.tsx`, `src/routes/dashboard.teacher.settings.tsx`, `src/lib/worksheet-parser.ts`, `src/lib/worksheet-context.ts`, `src/lib/chat-tools.server.ts`, `src/components/chat-widget.tsx`, `src/lib/settings.ts`, `src/lib/utils.ts`
- **Create:** `src/lib/domain-labels.ts`, `src/lib/notifications.ts`, `src/lib/google-docs.ts`, `src/lib/chat-memory.server.ts`, `src/lib/face-recognition.ts`, `src/lib/rate-limit.ts`, `src/components/dropzone.tsx`, `src/routes/dashboard.teacher.students.tsx`, `src/routes/kiosk.face-verify.tsx`, `supabase/migrations/20260830000001_sessions.sql`, `supabase/migrations/20260830000002_lock_rls.sql`, `supabase/migrations/20260831_g7_college_courses.sql`, `supabase/migrations/20260831_announcement_attachments.sql`, `supabase/migrations/20260831_chat_memories.sql`, `supabase/migrations/20260831_score_release.sql`, `supabase/migrations/20260831_worksheet_uploads.sql` (+ optional face index) — keep `public/miow-logo.svg` canonical

---

Plan complete and saved. Ready to execute using subagent-driven-development — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
