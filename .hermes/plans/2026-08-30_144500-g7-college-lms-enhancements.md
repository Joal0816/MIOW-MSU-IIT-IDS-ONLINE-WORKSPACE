# MIOW — G7-College Feature Enhancements Implementation Plan (Brand: MIOW Retained)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Deliver G7-College feature coverage (Grades 7 to College), pedagogical renames, remove Lovable credits, add Google Docs manual worksheets, upgrade course creation for G7-COLLEGE levels, enhance teacher/student dashboards, add drag-and-drop uploads, gate worksheet scores behind teacher release, give AI chatbot long-term memory, and scaffold optional facial recognition — **while retaining the MIOW (MSU-IIT IDS ONLINE WORKSPACE) brand** (no rebrand).

**Architecture:** Retain **MIOW** brand via `src/lib/brand.ts` (no rename; single source of truth), TanStack Start server functions (src/lib/lms.server.ts / lms.functions.ts) as auth boundary, Supabase (service_role client in src/integrations/supabase/client.server.ts) as data layer with RLS mirror, Storage buckets for attachments, AI Gateway (src/lib/ai-gateway.server.ts) + chat-tools.server.ts for chatbot, new tables: `worksheet_submissions` (file uploads), `chat_memories`, `announcement_attachments`, `course_grade_configs`. Google Docs: Picker API + Drive export. Facial rec: face-api.js / onnx pre-trained, client-side embedding + server verify. **Brand invariant:** `APP_NAME`, `APP_SHORT_NAME`, `NOTIFICATION_SIGNOFF` remain MIOW.

**Tech Stack:** TanStack Start (Vite 8, Nitro), React 19, Supabase JS 2.112, TanStack Query 5, Tailwind 4, shadcn/ui, bcryptjs, zod, AI SDK 7, Google Picker + Drive API, optional face-api.js.

---

## Current Context / Assumptions

- App currently branded **MIOW (MSU-IIT IDS ONLINE WORKSPACE)** via `src/lib/brand.ts:5-12` (APP_NAME, APP_SHORT_NAME, NOTIFICATION_SIGNOFF) and `src/components/brand.tsx` (MiowMark/MiowWordmark). `src/routes/__root.tsx:81` title is `MIOW`. **Keep as-is** — plan retains MIOW brand (G7-College refers to grade coverage, not a rename).
- Assignment model = `assignments` table + `submissions` + `quizzes`/`quiz_questions` separate. User wants "rename assignment into appropriate name" — map to domain: Assignments → Activities / Tasks / Worksheets (choose). Must keep DB backward compat or migrate.
- `NOTIFICATION_SIGNOFF` ready but unused — no email/push pipeline. Will leave signoff for later but add `src/lib/notifications.ts` stub.
- Manual worksheet via Google Docs: currently `src/lib/worksheet-parser.ts` parses 4-section text; `src/routes/dashboard.admin.courses.tsx:59k` + `worksheet-context.ts` generates via AI. Need "Import from Google Docs" path.
- Courses: `src/routes/dashboard.admin.courses.tsx` (CoursesPage) already has grade_level, color, days/schedule, teacher_id. G7-COLLEGE means grade_level enum 7-12 + college year 1-4, not just "10".
- Teachers dashboard menu: `src/components/lms.tsx: staffNav` + `dashboard.admin.*` routes. Needs "Students Info" quick list.
- Announcements: `src/routes/dashboard.admin.announcements.tsx` (277 lines, simple form) — needs drag-drop file attachments.
- AI chatbot: `src/components/chat-widget.tsx` (localStorage history) + `src/lib/chat-tools.server.ts` + `src/lib/ai-gateway.server.ts` (Lovable AI Gateway). No cross-session memory beyond localStorage; server tools are stateless.
- Student dashboards: `dashboard.student.quizzes.tsx` (19k, shows score instantly via SubmitQuizResult), `dashboard.student.assignments.tsx` (340 lines, has drag but not full worksheet upload), `dashboard.student.index.tsx` filtered by grade_level. Requirement: hide score until teacher releases answer key.
- Facial recog optional: profiles has `face_embedding text` already; no enrollment/verify flow except `enrollBiometrics` stub in lms.

## Proposed Approach

1. **Brand retention + pedagogical rename (no DB break)** — keep `src/lib/brand.ts` as MIOW (verify no hardcoded alt names), alias types (Assignment → Activity) via type alias + UI labels, DB keeps `assignments`. Remove Lovable strings from `vite.config.ts`, `src/lib/lovable-error-reporting.ts`, `src/integrations/supabase/client.ts` Lovable preview broker, package.json.
2. **Data extensions** — add migrations for `release_score` on quizzes/assignments, `announcement_attachments`, `worksheet_uploads`/`submission_files`, `chat_memories`, `google_docs_links`.
3. **G7-College course** — extend grade_level to 7-12 + college 13-16, add `education_level: 'jhs'|'shs'|'college'` + `strand`/`program` fields, UI selector.
4. **Worksheets: Google Docs import** — Picker → export docx/markdown → feed parser → preview → createQuizWithQuestions/createAssignment.
5. **Uploads: drag-drop** — reuse existing `dashboard.student.assignments.tsx:55 dragging` + `PendingDropzone` from courses, extend to announcements & quizzes.
6. **Score gating** — add `score_released boolean` + `answer_key_released boolean`; student view respects gate; teacher toggle in CoursesPage saveQuizEdit.
7. **Chat memory** — new `chat_memories` table + server RAG over past attendance/grades/announcements + recent chat summary; persist via Supabase not just localStorage.
8. **Facial rec (optional, last)** — client face-api, enrollment via `enrollBiometrics`, verify on kiosk.

Each task = TDD where possible (failing test → fix → pass → commit). DRY: extract `Dropzone`, `releaseToggle`, `brand()` helper.

---

## Step-by-Step Plan

### Task 1 — Confirm MIOW brand (retain, no rebrand)

**Objective:** Keep MIOW single source; verify no hardcodes or accidental G7-College brand leakage.

**Files:**
- Verify (no change): `src/lib/brand.ts:5-26` stays `APP_NAME="MSU-IIT IDS ONLINE WORKSPACE (MIOW)"`, `APP_SHORT_NAME="MIOW"`, `NOTIFICATION_SIGNOFF="Sincerely,\nThe MIOW Administration Team"`
- Verify: `src/components/brand.tsx:44-91` (MiowMark/MiowWordmark still MIOW)
- Verify: `src/routes/__root.tsx:76-89` (title/meta still `MIOW - MSU-IIT IDS Online Workspace`)
- Verify: `public/miow-logo.svg` remains canonical (no `/g7-logo.svg` switch)
- Search: `grep -rn "G7-College.*LMS\|G7-COLLEGE" src --include="*.ts" --include="*.tsx"` must return 0 for brand strings (G7-College only allowed for grade-level feature, not brand)

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

**Step 4 — Pass + commit** `git commit -m "chore(brand): confirm MIOW retained (no G7-College rebrand)"` (or no-op if already correct)

### Task 2 — Remove "Edit with Lovable" credits

**Objective:** Remove all Lovable marketing/edit affordances, keep AI Gateway if still used.

**Files:**
- Modify: `vite.config.ts:1-20` (remove @lovable.dev/vite-tanstack-config)
- Modify: `src/lib/lovable-error-reporting.ts` (stub or delete)
- Modify: `src/integrations/supabase/client.ts:29-56` (remove lovable-preview-auth broker)
- Modify: `src/integrations/supabase/auth-middleware.ts`, `client.server.ts` messages
- Modify: `package.json:21,89` (keep mcp-js only if needed, remove vite-tanstack-config)
- Modify: `src/lib/ai-gateway.server.ts` — rename if keeping Lovable gateway, or swap to OpenAI compatible env

**Steps:** grep `lovable` → replace messages "Connect Supabase in Lovable Cloud" → "Configure Supabase env". Remove floating badge component if exists (search `lovable` in `src/components`). Build after removal.

**Commit:** `chore: remove Lovable edit credits`

### Task 3 — Rename Assignment → Activity (UI label, type alias, keep DB)

**Objective:** Teacher/student see "Activity / Worksheet / Assessment" not generic "Assignment"; DB stays `assignments` for migration safety.

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

**Test:** UI renders "Activities" not "Assignments"; `listAssignments()` still works; search `Assignment` in src → no UI misses.

**Commit:** `feat(domain): rename Assignment -> Activity pedagogical label (DB stays assignments)`

### Task 4 — Notification pipeline stub (sign-off ready)

**Objective:** Make NOTIFICATION_SIGNOFF usable; add stub that logs until email added.

**Files:**
- Create: `src/lib/notifications.ts`
- Modify: `src/lib/brand.ts` (export signoff already)
- Modify: `src/routes/dashboard.admin.announcements.tsx` (call notify on create)

**Implement:**
```ts
// src/lib/notifications.ts
import { NOTIFICATION_SIGNOFF } from "./brand";
export async function notifyAnnouncement(a: Announcement) {
  // TODO: plug email/push provider; currently logs + returns
  console.log(`[notify] ${a.title}\n${NOTIFICATION_SIGNOFF}`);
  return { queued: false, reason: "no pipeline" };
}
```

**Commit:** `feat(notify): stub notification pipeline using signoff constant`

### Task 5 — G7-COLLEGE course model (JHS/SHS/College)

**Objective:** Courses span G7-12 + College 1-4 with level-aware filtering.

**Files:**
- Modify: `supabase/migrations/20260822144314*` concept (new migration)
- Create: `supabase/migrations/20260831_g7_college_courses.sql`
- Modify: `src/lib/lms.server.ts:320` (schemas courseInput)
- Modify: `src/routes/dashboard.admin.courses.tsx:55-77` (EMPTY_COURSE, grade_level select)
- Modify: `src/routes/dashboard.student.index.tsx:65` filter

**Migration:**
```sql
alter table public.courses add column if not exists education_level text check (education_level in ('jhs','shs','college')) default 'jhs';
alter table public.courses add column if not exists strand text; -- e.g., STEM, ABM, HUMSS for SHS
alter table public.courses add column if not exists program text; -- e.g., BSIT for college
-- grade_level 7-12 for jhs/shs, 13-16 for college Yr1-4
```

**UI:** Segmented control: JHS (7-10) | SHS (11-12 + strand) | College (Yr1-4 + program). `EMP_TY_COURSE.grade_level` becomes number 7-16. Student dashboard filters by `profile.grade_level` mapping.

**Test:** create course G7 Math, G12 STEM, College Yr1 BSIT → listCourses returns correctly.

**Commit:** `feat(courses): G7-College course levels`

### Task 6 — Admin & Teachers Dashboard: G7-COLLEGE course creation (UX)

**Objective:** Polished creation flow with grade/level, strand/program, color, schedule, teacher assign.

**Files:**
- Modify: `src/routes/dashboard.admin.courses.tsx:102-600` (CoursesPage form, POLICY_LABELS, COLORS)
- Modify: `src/components/lms.tsx` AppShell + staffNav

**Steps:** Add stepper: 1) Basic (title/code/level) 2) Assignment (teacher, strand/program) 3) Schedule (days/start/end/grace). Validate `grade_level` matches `education_level`. Show preview card via `courseStyle`.

**Commit:** `feat(courses): G7-College creation wizard`

### Task 7 — Teachers Dashboard: Students Info + Dashboard menu

**Objective:** Teacher quick view of roster, per-student grades/attendance, add student info.

**Files:**
- Modify: `src/routes/dashboard.admin.students.tsx` / `dashboard.admin.teachers.tsx`
- Create: `src/routes/dashboard.teacher.students.tsx` (or reuse admin students with role gate)
- Modify: `src/components/lms.tsx` (teacher nav: Dashboard, Students, Courses, Announcements, Grades, Attendance)
- Modify: `src/lib/lms.server.ts` `listStudents` already exists, add `getStudentInfo` aggregation

**Implement:** Teacher Dashboard index shows cards: My Courses, My Students (count), Pending Activities, Recent Submissions. Students Info table: name, grade/section, student_id, attendance %, avg grade, last active. Modal from `dashboard.student.settings.tsx:249` pattern for avatar. Search + grade filter.

**Commit:** `feat(teacher): students info + dashboard menu`

### Task 8 — Announcements drag-and-drop file uploads

**Objective:** Attach files to announcements via dropzone, storage in `announcement_attachments`.

**Files:**
- Create: `supabase/migrations/20260831_announcement_attachments.sql` (table + storage bucket)
- Modify: `src/routes/dashboard.admin.announcements.tsx:29-277` (form + drag state)
- Modify: `src/lib/lms.server.ts` + `lms.functions.ts` + `lms.ts` (create/update/list attachments)
- Modify: `src/components/lms.tsx` (render attachments)
- Reuse: drag logic from `dashboard.student.assignments.tsx:55` and `PendingDropzone` in admin.courses

**Migration:**
```sql
create table public.announcement_attachments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid references public.announcements(id) on delete cascade,
  file_url text not null, file_name text, file_size int, mime text, created_at timestamptz default now()
);
create bucket `announcement-files` public false;
```

**UI:** Dropzone Card with CloudUpload, file list with formatFileSize, X remove, upload on save via `uploadCourseMaterial` pattern.

**Commit:** `feat(announcements): drag-drop attachments`

### Task 9 — AI Chatbot: Memories for past activities

**Objective:** Chat remembers past queries/activities across sessions for efficiency.

**Files:**
- Create: `supabase/migrations/20260831_chat_memories.sql`
- Modify: `src/lib/chat-tools.server.ts:23-315` (systemPromptFor, build tools)
- Modify: `src/components/chat-widget.tsx:91` (loadHistory + persist)
- Create: `src/lib/chat-memory.server.ts` (summarize + store)

**Migration:**
```sql
create table public.chat_memories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  summary text not null, -- compressed last N turns
  last_n_messages jsonb, embedding vector? -- optional
  created_at timestamptz default now(), updated_at timestamptz
);
```

**Flow:**
1. On each `api/chat` POST (src/routes/api/chat.ts not yet read but exists), after response, summarize last 20 messages via AI (or truncation) and upsert `chat_memories`.
2. `systemPromptFor` injects `## Past context: ${memory.summary}` + last grades/attendance via existing tools `get_my_grades`, `list_my_assignments`.
3. Client `chat-widget.tsx:91 loadHistory` hydrates from server if localStorage empty.

**Storage:** server-side Supabase, not just localStorage. Add `chat_memories` to `src/integrations/supabase/types.ts`.

**Test:** send 3 queries → reload → assistant recalls "your Q1 Math grade".

**Commit:** `feat(chat): long-term memories for past activities`

### Task 10 — Students Dashboard: hide score until teacher releases

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
alter table public.quiz_attempts add column if not exists released boolean default false; -- per attempt
```

**Server:** `submitQuizAttempt` computes score but returns `{ ok:true, score: null, pendingRelease:true }` when not released. `quizAttemptInfo` + `myQuizSummaries` filter score if `!score_released`.

**Student UI (`quizzes.tsx:39-80`):**
```tsx
{result && !activeQuiz.score_released ? (
  <Card>Awaiting teacher release — submitted {fmtDate(result.submitted_at)}</Card>
) : (
  <Score score={result.score} answerKey={activeQuiz.answer_key_released ? questions : undefined} />
)}
```

**Teacher UI:** Switches in `saveQuiz`/`saveQuizEdit` form: "Release scores" / "Release answer key" + bulk Release button.

**Commit:** `feat(worksheets): teacher-gated score release`

### Task 11 — Worksheet: student upload files (drag-and-drop)

**Objective:** Students submit worksheets as file uploads, not just answers.

**Files:**
- Create: `supabase/migrations/20260831_worksheet_uploads.sql`
- Modify: `src/routes/dashboard.student.quizzes.tsx` (add Upload tab)
- Modify: `src/routes/dashboard.student.assignments.tsx` (already has drop, extend to quizzes)
- Modify: `src/lib/lms.server.ts` + `lms.functions.ts` + `lms.ts` (submitAssignmentFile, uploadWorksheetFile)
- Reuse: `formatFileSize` from `src/lib/lms.ts`, `CloudUpload` dropzone

**Migration:**
```sql
create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions(id) on delete cascade,
  file_url text, file_name text, mime text
);
-- or add file_url array to submissions
```

**UI:** In `QuizzesPage` add "Upload file" alongside answer inputs (for essay/matching supporting doc). In `AssignmentsPage` enhance existing `dragging` (line 55) to accept multiple files, progress bar, `formatFileSize`. Same Dropzone component as Task 8 — extract to `src/components/dropzone.tsx`.

**Commit:** `feat(worksheets): student file upload drag-drop`

### Task 12 — Dashboard menus (Student + Teacher) polish

**Objective:** Consistent AppShell nav, breadcrumbs, G7-College grouping.

**Files:**
- Modify: `src/components/lms.tsx` (STUDENT_NAV, staffNav, AppShell sidebar)
- Modify: `src/routes/dashboard.student.index.tsx:1-65`, `dashboard.student.tsx`
- Modify: `src/routes/dashboard.admin.index.tsx`, `dashboard.admin.tsx`, teacher routes

**Nav:**
- Student: Dashboard | Activities | Worksheets | Grades | Attendance | Announcements
- Teacher: Dashboard | Students Info | Courses (G7-COLLEGE) | Worksheets | Announcements | Grades | Attendance
- Admin: all + Settings, Teachers

Add `useProfile` gate already in place. Ensure `pageTitle()` uses **MIOW** via `src/lib/brand.ts`.

**Commit:** `feat(nav): MIOW dashboard menus with G7-College course grouping`

### Task 13 — Manual worksheet: Google Docs integration

**Objective:** Import worksheet content directly from a Google Doc, parse via worksheet-parser, create quiz/assignment.

**Files:**
- Modify: `src/lib/worksheet-parser.ts:1-75` (accept Google Docs export HTML)
- Modify: `src/routes/dashboard.admin.courses.tsx` (Add "Import from Google Docs" button)
- Create: `src/lib/google-docs.ts` (Picker + Drive export helper)
- Modify: `src/lib/worksheet-context.ts:18-20` (include doc link in context)
- Env: `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY` (Picker)

**Flow:**
1. Teacher clicks "Import from Google Docs" → Google Picker (uses gapi) → pick `document` → fetch export via `https://www.googleapis.com/drive/v3/files/{id}/export?mimeType=text/markdown` (or docx → mammoth).
2. Client sends markdown to `parseWorksheet(markdown)` (already handles markdown stripping `clean()` line 44).
3. Show preview (questions count, dropped) → confirm → `createQuizWithQuestions` / `createAssignment`.
4. Store source `google_doc_id` + `url` on quiz `metadata` JSON.

**Picker snippet:**
```ts
// src/lib/google-docs.ts
export function openGooglePicker(onPick: (doc: {id:string, name:string, url:string})=>void) { /* gapi.load picker */ }
export async function exportDocAsText(id:string, token:string) { /* Drive export */ }
```

**Fallback:** paste Google Docs share link → server fetches via Drive API with teacher's OAuth.

**Commit:** `feat(worksheets): Google Docs import for manual worksheets`

### Task 14 — Optional: Working facial recognition (pre-trained) [STRETCH]

**Objective:** Face enrollment + verification using pre-trained model; works offline-ish.

**Files:**
- Create: `src/lib/face-recognition.ts` (client face-api wrapper)
- Modify: `src/routes/dashboard.admin.students.tsx` / `dashboard.teacher.settings.tsx` (Enroll Face button)
- Modify: `src/lib/lms.server.ts` `enrollBiometrics` (store embedding), `findByRfid`/`verifyPinLogin` add face fallback
- Modify: `src/integrations/supabase/types.ts` profiles face_embedding
- Add dep: `@vladmandic/face-api` or `face-api.js` (pre-trained tinyFaceDetector + faceRecognitionNet)
- Create: `src/routes/kiosk.face-verify.tsx` (kiosk verify screen)

**Approach:**
- Client loads pre-trained models from `/models` (public).
- Enroll: capture video → detect → compute 128-d embedding → POST to `enrollBiometricsFn` → store as Base64 in `profiles.face_embedding`.
- Verify: kiosk captures → embedding → server `supabase.rpc('match_face', {embedding})` or JS cosine distance against enrolled (threshold 0.6). No new table needed.
- Privacy: embeddings only; add consent toggle; gate behind `face_recognition_enabled` setting.

**Do NOT block main release** — feature-flag `VITE_FACE_ENABLED=false` by default.

**Commit:** `feat(optional): face recognition scaffolding (pre-trained, flagged off)`

---

## Tests / Validation

- Unit: `brand.test.ts` (MIOW retained), `domain-labels.test.ts` (Activity label), `notifications.test.ts` (stub), `parseWorksheet google docs` (paste export), `score release` (submit → hidden until released), `chat memory` (summary injection)
- Component: Dropzone (drag over, drop 2 files, formatFileSize), Course wizard (JHS 7 → SHS 12 → College Yr1), Announcements attachments, Students Info table
- Integration: `bun run build` must stay green after each task; `bun run lint`; Supabase migrations `supabase db push --dry-run`; manual: create G7 course → student sees in dashboard → teacher creates worksheet via Google Docs import → student submits file drag-drop → teacher releases score → student sees score
- Search verification: `grep -rn "Lovable\\|lovableproject" src` → 0 after Task 2 (except ai-gateway if kept with env rename); `grep -rn "MIOW" src` should remain positive (brand); `grep -rn "Assignment" src --include="*.tsx"` → only comments/DB
- Security check after: `check_index_coverage` on modified files (brand.ts, lms.server.ts, chat-tools.server.ts, announcements/quizzes routes)

## Risks, Tradeoffs, Open Questions

- **Risk:** Renaming Assignment → Activity touches 30+ UI strings but DB stays `assignments` — old API `listAssignments` kept as alias to avoid breaking enrolments; mobile/cache keys still `assignments` — document in README.
- **Tradeoff:** G7-College grade_level 7-16 vs current 10 only — old data grade_level 10 stays valid; need backfill `education_level='jhs'` for existing rows.
- **Tradeoff:** Google Picker requires Google Cloud project + OAuth consent + Drive scope — provide env template + fallback manual paste import if keys missing.
- **Risk:** Score gating changes student expectation ("see your score instantly" in `quizzes.tsx:32` meta) — update copy to "submitted, awaiting release".
- **Risk:** Lovable AI Gateway removal → chat break — keep gateway rename to `AI_GATEWAY_KEY` instead of hard remove if still in use; plan offers both paths.
- **Open:** Human "sign-off constant ready but unused" — Task 4 stub does not send email; when pipeline added, inject `NOTIFICATION_SIGNOFF` into email footer centrally.
- **Open:** Facial recognition accuracy vs lighting — keep optional, behind flag, server fallback to PIN; biometric enrollment needs explicit consent per DepEd.
- **YAGNI:** Do not add full SIS (enrollment payments) — keep `enrollStudent` as is; do not rebuild grading; reuse `formatFileSize`/`Dropzone` extract.

## File Change Summary

- **Modify:** `src/lib/brand.ts` (verify retained), `src/components/brand.tsx` (verify), `src/routes/__root.tsx` (verify), `vite.config.ts`, `src/integrations/supabase/client.ts`, `client.server.ts`, `auth-middleware.ts`, `src/lib/lovable-error-reporting.ts`, `package.json`, `src/lib/lms.ts`, `src/integrations/supabase/types.ts`, `src/components/lms.tsx`, `src/routes/dashboard.admin.courses.tsx`, `dashboard.admin.announcements.tsx`, `dashboard.admin.students.tsx`, `dashboard.student.assignments.tsx`, `dashboard.student.quizzes.tsx`, `dashboard.student.index.tsx`, `dashboard.admin.index.tsx`, `dashboard.teacher.settings.tsx`, `src/lib/worksheet-parser.ts`, `src/lib/worksheet-context.ts`, `src/lib/chat-tools.server.ts`, `src/components/chat-widget.tsx`, `src/lib/ai-gateway.server.ts`
- **Create:** `src/lib/domain-labels.ts`, `src/lib/notifications.ts`, `src/lib/google-docs.ts`, `src/lib/chat-memory.server.ts`, `src/lib/face-recognition.ts`, `src/components/dropzone.tsx`, `src/routes/dashboard.teacher.students.tsx`, `src/routes/kiosk.face-verify.tsx`, `supabase/migrations/20260831_*.sql` ×5 (g7 college, score_release, announcement_attachments, chat_memories, worksheet_uploads + optional face index) — **keep `public/miow-logo.svg` as brand logo (no g7-logo.svg)**

---

Plan complete and saved. Ready to execute using subagent-driven-development — I'll dispatch a fresh subagent per task with two-stage review (spec compliance then code quality). Shall I proceed?
