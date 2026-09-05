# MIOW — MSU-IIT IDS Online Workspace

A modern Learning Management System (LMS) for Junior and Senior High School. Built with TanStack Start, Vite, React, TypeScript, and Tailwind CSS.

## Quick Start

```sh
git clone https://github.com/MIOW-CODES/lms.git
cd lms
bun install
cp .env.example .env   # edit with your values
bun run dev
```

Open `http://127.0.0.1:3000` — you'll see the login page.

### Seed PINs (test accounts)

| Email | Role | PIN |
|---|---|---|
| `admin@g.msuiit.edu.ph` | Admin | `0000` |
| `maria.santos@northview.edu` | Teacher | `1111` |
| `juan.delacruz@student.northview.edu` | Student | `1234` |

## Database Setup

The app uses **Supabase** as its primary database backend.

### Supabase (cloud)

1. Create a project at [supabase.com](https://supabase.com)
2. Link the Supabase CLI:
   ```sh
   supabase login
   supabase link --project-ref tqohsptzgbftwrxtxcka
   ```
3. Push the schema:
   ```sh
   supabase db push
   ```
4. In `.env`, set:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
   ```

### Local Postgres (development)

For local development without Supabase:

1. Run Postgres (Docker recommended):
   ```sh
   docker compose up -d
   ```
2. Run migrations:
   ```sh
   bun run db:migrate
   ```
3. In `.env`, set:
   ```
   DATABASE_URL=postgres://miow:miow_dev_password@localhost:5432/miow
   ```

The app auto-detects which backend to use based on your env vars.

## Environment Variables

See `.env.example` for the full list. Required:

| Variable | Description |
|---|---|
| `SESSION_SECRET` | HMAC key for session tokens (`openssl rand -hex 32`) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Supabase credentials |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase client-side credentials |

## Features

### Authentication

- **RFID tap** — auto-captures 10-13 digit card scanner keystrokes
- **PIN login** — manual fallback with rate limiting (5 attempts / 15 min)
- **Face verification** — WebRTC camera capture (placeholder for ML models)
- HMAC-SHA256 session tokens with JTI revocation

### Admin Dashboard

- **Students** — view roster, bind RFID cards, manage profiles
- **Teachers** — teacher directory and assignment
- **Courses** — create courses with CED program dropdown (12 MSU-IIT programs), Google Docs import
- **Announcements** — create with file attachments, audience targeting
- **Grades** — editable gradebook with DepEd transmutation
- **Settings** — system configuration, audit log

### Teacher Dashboard

- Create worksheets (ClassMate AI or manual entry)
- Grade submissions
- View student attendance

### Student Dashboard

- **Courses** — enrolled courses with worksheets and activities
- **Grades** — quarterly grade breakdown
- **Activities** — submit assignments
- **Attendance** — view attendance history

### ClassMate Chatbot

AI-powered academic assistant using mimo-v2.5 via OpenCode Go. Restricted to academic topics only (course content, LMS features, DepEd standards).

Requires `OPENCODE_API_KEY` in `.env`.

### Google Docs Integration

Import Google Docs as worksheet source material.

**Setup:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → enable **Google Picker API** + **Google Docs API**
3. **OAuth consent screen** → External → add your Gmail as test user
4. **Credentials** → OAuth Client ID (Web app):
   - Authorized origins: `http://127.0.0.1:3000`
   - Copy the Client ID
5. **Credentials** → API key → restrict to Picker + Docs APIs
6. In `.env`:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=***
   ```

### Security

- Content Security Policy (CSP) with Google APIs whitelisted
- Rate limiting (Redis optional, in-memory fallback)
- RLS policies on all database tables
- Session tokens with JTI revocation
- Input validation and sanitization

## Scripts

```sh
bun run dev          # Start dev server
bun run build        # Production build
bun run lint         # ESLint
bun run format       # Prettier
bun run test:e2e     # Playwright tests (headed mode)
bun run db:migrate   # Run Postgres migrations
bun run db:seed      # Seed test data
```

## Tech Stack

- **Framework:** TanStack Start + Vite 8
- **UI:** React, Tailwind CSS, Framer Motion, Lucide icons
- **Database:** Supabase OR local Postgres (auto-detected)
- **Auth:** HMAC-SHA256 session tokens, RFID + PIN
- **Chat:** mimo-v2.5 via OpenCode Go
- **Testing:** Playwright (headed mode)
- **Runtime:** Bun

## License

Private — MSU-IIT IDS
