import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { saveSession, type Profile } from "@/lib/lms";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

const DEV_PROFILES: Record<string, Profile> = {
  admin: {
    id: "dev-admin-0001",
    student_id: null,
    email: "admin@miow.dev",
    pin: null,
    full_name: "Dev Admin",
    role: "admin",
    rfid_uid: null,
    avatar_url: null,
    face_embedding: null,
    grade_level: null,
    section: null,
    created_at: new Date().toISOString(),
    employee_id: "DEV-ADM-01",
    department: "IDS",
    session_token: "dev-bypass-token-admin",
    has_pin: true,
    has_rfid: false,
  },
  teacher: {
    id: "dev-teacher-0001",
    student_id: null,
    email: "teacher@miow.dev",
    pin: null,
    full_name: "Dev Teacher",
    role: "teacher",
    rfid_uid: null,
    avatar_url: null,
    face_embedding: null,
    grade_level: null,
    section: null,
    created_at: new Date().toISOString(),
    employee_id: "DEV-TCH-01",
    department: "IDS",
    session_token: "dev-bypass-token-teacher",
    has_pin: true,
    has_rfid: false,
  },
  student: {
    id: "dev-student-0001",
    student_id: "2026-0001",
    email: "student@miow.dev",
    pin: null,
    full_name: "Dev Student",
    role: "student",
    rfid_uid: null,
    avatar_url: null,
    face_embedding: null,
    grade_level: 10,
    section: "Dev-Section",
    created_at: new Date().toISOString(),
    session_token: "dev-bypass-token-student",
    has_pin: true,
    has_rfid: false,
  },
};

function IndexPage() {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  // In production: keep old behavior (force /auth)
  useEffect(() => {
    if (!isDev) navigate({ to: "/auth", replace: true });
  }, [isDev, navigate]);

  const enterAs = (role: "admin" | "teacher" | "student") => {
    const p = DEV_PROFILES[role];
    if (!p) return;
    saveSession(p);
    const to =
      role === "admin"
        ? "/dashboard/admin"
        : role === "teacher"
          ? "/dashboard/teacher"
          : "/dashboard/student";
    navigate({ to, replace: true });
  };

  if (!isDev) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Redirecting to sign-in…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          DEV ONLY — not shown in production
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground">MIOW Dev Launcher</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Skip the RFID/PIN kiosk and jump straight into any portal. Auth still lives at{" "}
          <Link to="/auth" className="font-medium text-primary underline underline-offset-4">
            /auth
          </Link>{" "}
          for checkout.
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => enterAs("admin")}
            className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Enter as Admin
          </button>
          <button
            onClick={() => enterAs("teacher")}
            className="rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
          >
            Enter as Teacher
          </button>
          <button
            onClick={() => enterAs("student")}
            className="rounded-xl border border-input bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
          >
            Enter as Student
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go to Auth page →
          </Link>
          <a
            href="/dashboard/admin"
            onClick={(e) => {
              e.preventDefault();
              enterAs("admin");
            }}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            quick: /dashboard/admin
          </a>
        </div>

        <p className="mt-6 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Tip: dashboards use your local dev session (<code>northview-lms-session</code>). Server data
          still needs <code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code> — without it
          you&apos;ll see empty states but the shell/nav still renders.
        </p>
      </div>
    </div>
  );
}
