import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ATTENDANCE_LIMIT_PURGE } from "@/components/courses/constants";
import {
  Database,
  Download,
  Nfc,
  Save,
  School,
  ScrollText,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  Trash2,
  TriangleAlert,
  UserCog,
  Users,
  Volume2,
} from "lucide-react";
import {
  ADMIN_NAV,
  AppShell,
  Badge,
  Card,
  Field,
  Modal,
  Toggle,
  useProfile,
} from "@/components/lms";
import {
  fmtDate,
  fmtTime,
  listAllAttendance,
  listAllUsers,
  listCourses,
  listGradesForCourse,
  listTeachers,
  listStudents,
  TRANSMUTATION_TABLE,
  updateCourse,
  updateUserRole,
  deleteAttendanceLog,
  deleteProfile,
  type Profile,
  type Role,
} from "@/lib/lms";
import {
  downloadFile,
  getAdminConfig,
  listAudit,
  logAudit,
  resetLocalPreferences,
  saveAdminConfig,
  toCsv,
  type AdminConfig,
  type AuditEntry,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { BRAND_COLORS, BRAND_LOGO_SRC } from "@/lib/brand";
import { MiowLockup, MiowMark } from "@/components/brand";

export const Route = createFileRoute("/dashboard/admin/settings")({
  head: () => ({
    meta: [
      { title: "Admin Settings | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content:
          "Configure grading weights, kiosk hardware, role permissions, backups, and audit logs.",
      },
      { property: "og:title", content: "Admin Settings | MIOW - Integrated Developmental School" },
      {
        property: "og:description",
        content:
          "Configure grading weights, kiosk hardware, role permissions, backups, and audit logs.",
      },
    ],
  }),
  component: AdminSettings,
});

type Tab = "school" | "kiosk" | "roles" | "logs";

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "school", label: "School System", icon: <School className="h-4 w-4" /> },
  { value: "kiosk", label: "Hardware & Kiosk", icon: <Nfc className="h-4 w-4" /> },
  { value: "roles", label: "Users & Roles", icon: <Users className="h-4 w-4" /> },
  { value: "logs", label: "Logs & Backups", icon: <ScrollText className="h-4 w-4" /> },
];

const SCHEMA_DUMP = `-- MIOW — PostgreSQL schema dump (demo export)
CREATE TABLE profiles (id uuid PRIMARY KEY, full_name text NOT NULL, student_id text, email text, role text NOT NULL, grade_level int, section text, pin_hash text, rfid_uid text, avatar_url text, created_at timestamptz DEFAULT now());
CREATE TABLE announcements (id uuid PRIMARY KEY, title text NOT NULL, content text NOT NULL, category text NOT NULL, target_audience text DEFAULT 'all', pinned boolean DEFAULT false, author_id uuid REFERENCES profiles(id), created_at timestamptz DEFAULT now());
CREATE TABLE courses (id uuid PRIMARY KEY, code text NOT NULL, title text NOT NULL, grade_level int NOT NULL, teacher_id uuid REFERENCES profiles(id), color text);
CREATE TABLE enrollments (id uuid PRIMARY KEY, student_id uuid REFERENCES profiles(id), course_id uuid REFERENCES courses(id));
CREATE TABLE assignments (id uuid PRIMARY KEY, course_id uuid REFERENCES courses(id), title text NOT NULL, description text, component_type text NOT NULL, due_date timestamptz, max_score numeric DEFAULT 100);
CREATE TABLE submissions (id uuid PRIMARY KEY, assignment_id uuid REFERENCES assignments(id), student_id uuid REFERENCES profiles(id), content text, file_name text, status text DEFAULT 'pending', score numeric, feedback text, submitted_at timestamptz);
CREATE TABLE quizzes (id uuid PRIMARY KEY, course_id uuid REFERENCES courses(id), title text NOT NULL, duration_minutes int DEFAULT 15, available boolean DEFAULT true);
CREATE TABLE quiz_questions (id uuid PRIMARY KEY, quiz_id uuid REFERENCES quizzes(id), question text NOT NULL, options jsonb NOT NULL, correct_answer text NOT NULL, position int DEFAULT 0);
CREATE TABLE grades (id uuid PRIMARY KEY, student_id uuid REFERENCES profiles(id), course_id uuid REFERENCES courses(id), quarter int NOT NULL, written_work_score numeric, performance_task_score numeric, exam_score numeric, transmuted_final_grade numeric);
CREATE TABLE attendance_logs (id uuid PRIMARY KEY, student_id uuid REFERENCES profiles(id), timestamp timestamptz DEFAULT now(), scan_type text NOT NULL, status text NOT NULL);
-- Row Level Security: default-deny on all tables; access via signed-token server functions.`;

const ROLE_LABEL: Record<Role, string> = { student: "Student", teacher: "Teacher", admin: "Admin" };

function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
      {initials || "?"}
    </span>
  );
}

function AdminSettings() {
  const profile = useProfile(["admin"]);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("school");
  const [cfg, setCfg] = useState<AdminConfig | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [scanTest, setScanTest] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | "reset" | "purge">(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  // User Directory & Role Assignment state
  const [dirQuery, setDirQuery] = useState("");
  const [dirRole, setDirRole] = useState<"all" | Role>("all");
  const [roleChange, setRoleChange] = useState<null | { user: Profile; next: Role }>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Course-lead pickers list TEACHERS only — admins never appear there.
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: listTeachers,
    enabled: !!profile,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  const { data: directory } = useQuery({
    queryKey: ["directory"],
    queryFn: listAllUsers,
    enabled: !!profile,
  });

  useEffect(() => {
    if (profile && !cfg) {
      setCfg(getAdminConfig());
      setAudit(listAudit());
    }
  }, [profile, cfg]);

  if (!profile || !cfg) return null;

  const persistCfg = (next: AdminConfig, message = "Changes saved successfully") => {
    setCfg(next);
    saveAdminConfig(next);
    toast.success(message);
  };

  const weightSum = cfg.weights.attendance + cfg.weights.ww + cfg.weights.exam + cfg.weights.pt;
  const weightsValid = weightSum === 100;

  const saveSchoolConfig = () => {
    if (!weightsValid) {
      toast.error(`Grading weights must total 100% (currently ${weightSum}%)`);
      return;
    }
    persistCfg(cfg);
    logAudit(
      "Grading config updated",
      `Attendance ${cfg.weights.attendance}% / WW ${cfg.weights.ww}% / Exam ${cfg.weights.exam}% / PT ${cfg.weights.pt}% · pass ≥ ${cfg.passingThreshold}%`,
    );
    setAudit(listAudit());
  };

  const simulateScan = () => {
    const raw = scanTest.trim();
    if (!raw) {
      toast.error("Type or paste a raw badge payload first");
      return;
    }
    let parsed = raw;
    if (cfg.rfidPrefix && parsed.startsWith(cfg.rfidPrefix))
      parsed = parsed.slice(cfg.rfidPrefix.length);
    if (cfg.rfidSuffix && parsed.endsWith(cfg.rfidSuffix))
      parsed = parsed.slice(0, -cfg.rfidSuffix.length);
    if (cfg.audioChime) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } catch {
        /* audio blocked */
      }
    }
    toast.success(`Parsed UID: ${parsed}`, {
      description: `Prefix "${cfg.rfidPrefix || "none"}" · Suffix "${cfg.rfidSuffix || "none"}" · Enter delimiter ${cfg.enterDelimiter ? "on" : "off"}`,
    });
  };

  const exportStudents = async () => {
    try {
      const rows = await listStudents();
      const csv = toCsv([
        ["Student ID", "Full Name", "Email", "Grade Level", "Section"],
        ...rows.map((s) => [s.student_id, s.full_name, s.email, s.grade_level, s.section]),
      ]);
      downloadFile("northview-students.csv", csv, "text/csv");
      logAudit("Data export", `Student database CSV exported (${rows.length} rows)`);
      setAudit(listAudit());
      toast.success("Student database exported");
    } catch {
      toast.error("Failed to export student data");
    }
  };

  const exportGradebook = async () => {
    setBusy(true);
    try {
      const cs = await listCourses();
      const out = [];
      for (const c of cs) {
        const grades = await listGradesForCourse(c.id, cfg.activeQuarter);
        out.push({ course: c.code, title: c.title, quarter: cfg.activeQuarter, grades });
      }
      downloadFile(
        `northview-gradebook-q${cfg.activeQuarter}.json`,
        JSON.stringify(out, null, 2),
        "application/json",
      );
      logAudit("Data export", `Complete gradebook JSON exported (Q${cfg.activeQuarter})`);
      setAudit(listAudit());
      toast.success("Gradebook exported");
    } catch {
      toast.error("Failed to export gradebook");
    } finally {
      setBusy(false);
    }
  };

  const exportSchema = () => {
    downloadFile("northview-schema.sql", SCHEMA_DUMP, "application/sql");
    logAudit("Data export", "PostgreSQL schema dump downloaded");
    setAudit(listAudit());
    toast.success("Schema dump downloaded");
  };

  const runConfirmed = async () => {
    if (confirmText !== "RESET") {
      toast.error('Type "RESET" to confirm');
      return;
    }
    setBusy(true);
    try {
      if (confirmAction === "reset") {
        resetLocalPreferences();
        setCfg(getAdminConfig());
        logAudit("Factory reset", "Local mock data and preferences reset to defaults");
        setAudit(listAudit());
        toast.success("Mock data reset to defaults");
      } else if (confirmAction === "purge") {
        const logs = await listAllAttendance(ATTENDANCE_LIMIT_PURGE);
        for (const l of logs) await deleteAttendanceLog(l.id);
        logAudit("Data purge", `${logs.length} demo attendance logs purged`);
        setAudit(listAudit());
        toast.success(`Purged ${logs.length} attendance logs`);
      }
      setConfirmAction(null);
      setConfirmText("");
    } catch {
      toast.error("Operation failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  const filteredAudit = audit.filter((e) => {
    const q = auditQuery.toLowerCase();
    return !q || `${e.actor} ${e.action} ${e.detail}`.toLowerCase().includes(q);
  });

  /* ---------- User Directory & Role Assignment ---------- */

  const filteredDirectory = (directory ?? []).filter((u) => {
    if (dirRole !== "all" && u.role !== dirRole) return false;
    const q = dirQuery.trim().toLowerCase();
    if (!q) return true;
    return [u.full_name, u.email ?? "", u.student_id ?? ""].some((f) =>
      f.toLowerCase().includes(q),
    );
  });

  /** Context-aware confirmation copy for each role transition. */
  const roleChangeMessage = (user: Profile, next: Role): string => {
    if (next === "teacher") {
      if (user.role === "admin") {
        return `Revoking administrator access: ${user.full_name} loses system settings, user & role management, hardware configuration, and logs. They keep classroom tools — gradebooks, worksheet generation, and attendance tracking.`;
      }
      return `Changing role from ${ROLE_LABEL[user.role]} to Teacher will grant access to gradebooks, worksheet creation, and course management. Any existing academic records are preserved.`;
    }
    if (next === "admin") {
      return `Promoting ${user.full_name} from ${ROLE_LABEL[user.role]} to Admin grants full administrative control — user management, grading configuration, kiosk settings, and data tools. They will no longer appear in teaching rosters or course-lead pickers.`;
    }
    const leads = (courses ?? []).filter((c) => c.teacher_id === user.id).length;
    return `Changing role from ${ROLE_LABEL[user.role]} to Student revokes faculty tools.${
      leads > 0
        ? ` ${leads} active course lead${leads > 1 ? "s" : ""} will be unassigned automatically.`
        : ""
    }`;
  };

  const applyRoleChange = async () => {
    if (!roleChange) return;
    setRoleBusy(true);
    try {
      const res = await updateUserRole(roleChange.user.id, roleChange.next);
      logAudit(
        "Role updated",
        `${roleChange.user.full_name}: ${ROLE_LABEL[roleChange.user.role]} → ${ROLE_LABEL[roleChange.next]}${
          res.unassignedCourses > 0 ? ` · ${res.unassignedCourses} course lead(s) unassigned` : ""
        }`,
      );
      setAudit(listAudit());
      toast.success(`${roleChange.user.full_name} is now a ${ROLE_LABEL[roleChange.next]}`, {
        description:
          res.unassignedCourses > 0
            ? `${res.unassignedCourses} course lead${res.unassignedCourses > 1 ? "s" : ""} unassigned. Their permissions update on their next page load.`
            : "Their permissions update on their next page load.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["directory"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["teachers"] }),
        queryClient.invalidateQueries({ queryKey: ["courses"] }),
      ]);
      setRoleChange(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Role update failed");
    } finally {
      setRoleBusy(false);
    }
  };

  // Active (non-removed) admin count — drives the last-admin delete guard.
  const activeAdmins = (directory ?? []).filter((u) => u.role === "admin").length;

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await deleteProfile(deleteTarget.id);
      logAudit(
        "User removed",
        `${deleteTarget.full_name} (${ROLE_LABEL[deleteTarget.role]})${
          res.unassignedCourses > 0 ? ` · ${res.unassignedCourses} course lead(s) unassigned` : ""
        }`,
      );
      setAudit(listAudit());
      toast.success("User successfully removed.", {
        description:
          res.unassignedCourses > 0
            ? `${res.unassignedCourses} course lead${res.unassignedCourses > 1 ? "s" : ""} unassigned. Historical records are preserved.`
            : "Platform access revoked. Historical records are preserved.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["directory"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["teachers"] }),
        queryClient.invalidateQueries({ queryKey: ["courses"] }),
      ]);
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove user");
    } finally {
      setDeleteBusy(false);
    }
  };

  const gradeCounts = new Map<number, number>();
  (students ?? []).forEach((s) => {
    if (s.grade_level != null)
      gradeCounts.set(s.grade_level, (gradeCounts.get(s.grade_level) ?? 0) + 1);
  });

  return (
    <AppShell nav={ADMIN_NAV} profile={profile} subtitle="Admin Console">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          School configuration, kiosk hardware, permissions, and data tools.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              aria-current={tab === t.value ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                tab === t.value
                  ? "bg-primary text-primary-foreground shadow-lift"
                  : "bg-card/60 text-muted-foreground backdrop-blur-sm hover:bg-muted hover:text-foreground",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          {/* ---------- School System Configuration ---------- */}
          {tab === "school" && (
            <>
              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">System Branding</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The official MIOW identity is locked system-wide — the logomark, wordmark and
                  palette cannot be overridden per campus or per portal.
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background/60 p-5">
                    <MiowLockup size="md" />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {Object.entries(BRAND_COLORS).map(([name, hex]) => (
                        <span
                          key={name}
                          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[11px] font-semibold capitalize"
                        >
                          <span
                            className="h-3 w-3 rounded-full ring-1 ring-border"
                            style={{ backgroundColor: hex }}
                          />
                          {name} {hex}
                        </span>
                      ))}
                    </div>
                    <label className="mt-4 block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Logo asset (locked)
                      </span>
                      <input
                        value={BRAND_LOGO_SRC}
                        readOnly
                        disabled
                        aria-label="Official logo asset path (locked)"
                        className="w-full cursor-not-allowed rounded-xl border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                      />
                    </label>
                  </div>

                  {/* RFID / school ID card artwork reference for print vendors */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      RFID ID card template
                    </p>
                    <div
                      className="relative aspect-[1.586/1] w-full max-w-sm overflow-hidden rounded-2xl p-5 text-white shadow-lift"
                      style={{
                        background: `linear-gradient(135deg, ${BRAND_COLORS.navy} 0%, ${BRAND_COLORS.maroon} 100%)`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MiowMark plate={false} className="h-7 w-7" />
                        <div>
                          <p className="font-display text-sm font-extrabold tracking-[0.1em]">
                            MIOW
                          </p>
                          <p className="text-[8px] uppercase tracking-[0.18em] opacity-80">
                            Integrated Developmental School
                          </p>
                        </div>
                      </div>
                      <div className="absolute bottom-5 left-5">
                        <p className="text-[9px] uppercase tracking-[0.2em] opacity-70">
                          Learner ID
                        </p>
                        <p className="font-display text-base font-bold">2026-00417</p>
                      </div>
                      <div
                        className="absolute bottom-5 right-5 h-9 w-12 rounded-md"
                        style={{ background: BRAND_COLORS.gold, opacity: 0.85 }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Print spec: maroon-to-navy face, gold RFID coil plate, peak icon top-left.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Academic Calendar</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Academic Year
                    </span>
                    <select
                      value={cfg.academicYear}
                      onChange={(e) => setCfg({ ...cfg, academicYear: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {["2023–2024", "2024–2025", "2025–2026", "2026–2027"].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Active Quarter
                    </span>
                    <select
                      value={cfg.activeQuarter}
                      onChange={(e) => setCfg({ ...cfg, activeQuarter: Number(e.target.value) })}
                      className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {[1, 2, 3, 4].map((q) => (
                        <option key={q} value={q}>
                          Quarter {q}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">Grading Weights</h2>
                    <p className="text-xs text-muted-foreground">
                      Standard scheme: 10% Attendance · 20% Written Work · 30% Periodical Exam · 40%
                      Performance Tasks. The total must equal 100%.
                    </p>
                  </div>
                  <Badge tone={weightsValid ? "green" : "red"}>Total: {weightSum}%</Badge>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field
                    label="Attendance %"
                    type="number"
                    min={0}
                    max={100}
                    value={cfg.weights.attendance}
                    onChange={(e) =>
                      setCfg({
                        ...cfg,
                        weights: { ...cfg.weights, attendance: Number(e.target.value) },
                      })
                    }
                  />
                  <Field
                    label="Written Work %"
                    type="number"
                    min={0}
                    max={100}
                    value={cfg.weights.ww}
                    onChange={(e) =>
                      setCfg({ ...cfg, weights: { ...cfg.weights, ww: Number(e.target.value) } })
                    }
                  />
                  <Field
                    label="Periodical Exam %"
                    type="number"
                    min={0}
                    max={100}
                    value={cfg.weights.exam}
                    onChange={(e) =>
                      setCfg({ ...cfg, weights: { ...cfg.weights, exam: Number(e.target.value) } })
                    }
                  />
                  <Field
                    label="Performance Tasks %"
                    type="number"
                    min={0}
                    max={100}
                    value={cfg.weights.pt}
                    onChange={(e) =>
                      setCfg({ ...cfg, weights: { ...cfg.weights, pt: Number(e.target.value) } })
                    }
                  />
                </div>
                {!weightsValid && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <TriangleAlert className="h-3.5 w-3.5" /> Weights must sum to exactly 100%
                    before saving.
                  </p>
                )}
                <div className="mt-4">
                  <Field
                    label="Passing threshold (transmuted grade)"
                    type="number"
                    min={60}
                    max={100}
                    value={cfg.passingThreshold}
                    onChange={(e) => setCfg({ ...cfg, passingThreshold: Number(e.target.value) })}
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={saveSchoolConfig}
                    disabled={!weightsValid}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> Save configuration
                  </button>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Transmutation Table</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  DepEd DO 8, s. 2015 standard mapping (read-only reference).
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TRANSMUTATION_TABLE.slice(0, 8).map(([min, t]) => (
                    <div
                      key={min}
                      className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-center"
                    >
                      <p className="text-xs text-muted-foreground">≥ {min}</p>
                      <p className="font-display text-lg font-bold">{t}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  …down to initial 0 → transmuted 60.
                </p>
              </Card>
            </>
          )}

          {/* ---------- Hardware & Kiosk ---------- */}
          {tab === "kiosk" && (
            <>
              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Nfc className="h-5 w-5 text-primary" /> RFID Scanner Setup
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="UID prefix to strip"
                    value={cfg.rfidPrefix}
                    maxLength={8}
                    placeholder="e.g. NV-"
                    onChange={(e) => setCfg({ ...cfg, rfidPrefix: e.target.value })}
                  />
                  <Field
                    label="UID suffix to strip"
                    value={cfg.rfidSuffix}
                    maxLength={8}
                    placeholder="e.g. ;"
                    onChange={(e) => setCfg({ ...cfg, rfidSuffix: e.target.value })}
                  />
                </div>
                <div className="mt-3">
                  <Toggle
                    label="Enter-key delimiter"
                    description="Scanner terminates each badge read with the Enter key"
                    checked={cfg.enterDelimiter}
                    onChange={(v) => setCfg({ ...cfg, enterDelimiter: v })}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    value={scanTest}
                    onChange={(e) => setScanTest(e.target.value)}
                    placeholder="Raw badge payload, e.g. NV-0021847563"
                    aria-label="Test badge payload"
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring sm:max-w-xs"
                  />
                  <button
                    onClick={simulateScan}
                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    Test badge scan
                  </button>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Volume2 className="h-5 w-5 text-primary" /> Kiosk Terminal
                </h2>
                <div className="mt-4 space-y-2">
                  <Toggle
                    label="Audio chime on successful scan"
                    checked={cfg.audioChime}
                    onChange={(v) => setCfg({ ...cfg, audioChime: v })}
                  />
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Checkmark overlay duration (s)"
                    type="number"
                    min={1}
                    max={10}
                    value={cfg.overlayDuration}
                    onChange={(e) => setCfg({ ...cfg, overlayDuration: Number(e.target.value) })}
                  />
                  <Field
                    label="Auto-reset delay (s)"
                    type="number"
                    min={1}
                    max={30}
                    value={cfg.autoResetDelay}
                    onChange={(e) => setCfg({ ...cfg, autoResetDelay: Number(e.target.value) })}
                  />
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      persistCfg(cfg, "Kiosk configuration saved");
                      logAudit("Kiosk config updated", "Kiosk settings saved");
                      setAudit(listAudit());
                    }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90"
                  >
                    <Save className="h-4 w-4" /> Save kiosk settings
                  </button>
                </div>
              </Card>
            </>
          )}

          {/* ---------- Users & Roles ---------- */}
          {tab === "roles" && (
            <>
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                      <UserCog className="h-5 w-5 text-primary" /> User Directory & Role Assignment
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Reassign roles instantly — course leads are unassigned automatically when a
                      teacher becomes a student.
                    </p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={dirQuery}
                      onChange={(e) => setDirQuery(e.target.value)}
                      placeholder="Search name, email, or ID…"
                      aria-label="Search users"
                      className="rounded-xl border border-input bg-background/70 py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div
                  className="mb-4 flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter by role"
                >
                  {(["all", "student", "teacher", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setDirRole(r)}
                      aria-pressed={dirRole === r}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                        dirRole === r
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {r === "all" ? "All" : `${ROLE_LABEL[r]}s`}
                    </button>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-3">Name</th>
                        <th className="pb-2 pr-3">Email / ID</th>
                        <th className="pb-2 pr-3">Current Role</th>
                        <th className="pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredDirectory.map((u) => (
                        <tr key={u.id}>
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2.5">
                              {u.avatar_url ? (
                                <img
                                  src={u.avatar_url}
                                  alt={u.full_name}
                                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <Initials name={u.full_name} />
                              )}
                              <span className="font-semibold">
                                {u.full_name}
                                {u.id === profile.id && (
                                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                    (you)
                                  </span>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                            {u.email ?? "—"}
                            {u.student_id && <span className="block">{u.student_id}</span>}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge
                              tone={
                                u.role === "admin"
                                  ? "indigo"
                                  : u.role === "teacher"
                                    ? "sky"
                                    : "slate"
                              }
                            >
                              {ROLE_LABEL[u.role]}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              {u.role === "admin" ? (
                                // Dedicated admin demotion flow — confirmed via dialog.
                                <button
                                  onClick={() => setRoleChange({ user: u, next: "teacher" })}
                                  disabled={u.id === profile.id || activeAdmins <= 1}
                                  aria-label={`Revoke administrator access for ${u.full_name}`}
                                  title={
                                    u.id === profile.id
                                      ? "You can't change your own role"
                                      : activeAdmins <= 1
                                        ? "The last remaining admin can't be demoted"
                                        : "Revoke administrator access (demote to Teacher)"
                                  }
                                  className="flex items-center gap-1.5 rounded-xl border border-border bg-background/70 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <ShieldMinus className="h-3.5 w-3.5" /> Revoke admin
                                </button>
                              ) : (
                                <>
                                  {/* Inline switcher: Student ⇄ Teacher only. */}
                                  <select
                                    value={u.role}
                                    disabled={u.id === profile.id}
                                    onChange={(e) => {
                                      const next = e.target.value as Role;
                                      if (next !== u.role) setRoleChange({ user: u, next });
                                    }}
                                    aria-label={`Change role for ${u.full_name}`}
                                    className="rounded-xl border border-input bg-background/70 px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                                  >
                                    <option value="student">Student</option>
                                    <option value="teacher">Teacher</option>
                                  </select>
                                  {u.id !== profile.id && (
                                    // Dedicated admin promotion flow — confirmed via dialog.
                                    <button
                                      onClick={() => setRoleChange({ user: u, next: "admin" })}
                                      aria-label={`Promote ${u.full_name} to Administrator`}
                                      title="Promote to Administrator"
                                      className="rounded-xl border border-border p-1.5 text-muted-foreground transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
                                    >
                                      <ShieldPlus className="h-4 w-4" />
                                    </button>
                                  )}
                                </>
                              )}
                              {u.id !== profile.id && (
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  disabled={u.role === "admin" && activeAdmins <= 1}
                                  aria-label={`Remove ${u.full_name}`}
                                  title={
                                    u.role === "admin" && activeAdmins <= 1
                                      ? "The last remaining admin can't be removed"
                                      : `Remove ${u.full_name}`
                                  }
                                  className="rounded-xl border border-border p-1.5 text-muted-foreground transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDirectory.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center text-sm text-muted-foreground"
                          >
                            No users match this filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Teacher → Course Assignments</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Assign a subject lead for each course.
                </p>
                <div className="divide-y divide-border">
                  {(courses ?? []).map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.code} · Grade {c.grade_level}
                        </p>
                      </div>
                      <select
                        value={c.teacher_id ?? ""}
                        onChange={async (e) => {
                          const teacherId = e.target.value || null;
                          try {
                            await updateCourse(c.id, { teacher_id: teacherId });
                            const name =
                              (teachers ?? []).find((s) => s.id === teacherId)?.full_name ??
                              "Unassigned";
                            logAudit("Course reassigned", `${c.code} lead set to ${name}`);
                            setAudit(listAudit());
                            toast.success(`${c.code} → ${name}`);
                            await queryClient.invalidateQueries({ queryKey: ["courses"] });
                          } catch {
                            toast.error("Could not update assignment");
                          }
                        }}
                        aria-label={`Teacher for ${c.title}`}
                        className="rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Unassigned</option>
                        {(teachers ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Section Batching</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Current roster sizes per grade level.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[...gradeCounts.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([grade, count]) => (
                      <div
                        key={grade}
                        className="rounded-xl border border-border/60 bg-muted/40 px-4 py-3"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Grade {grade}
                        </p>
                        <p className="font-display text-2xl font-bold">{count}</p>
                      </div>
                    ))}
                </div>
                <button
                  onClick={() => {
                    logAudit(
                      "Batch promote requested",
                      "End-of-year section batching queued for registrar approval",
                    );
                    setAudit(listAudit());
                    toast.success("Batch promote queued for registrar approval");
                  }}
                  className="mt-4 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  Run end-of-year batch promote
                </button>
              </Card>

              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <ShieldCheck className="h-5 w-5 text-primary" /> Role Privileges
                </h2>
                <div className="mt-4 space-y-2">
                  <Toggle
                    label="Teachers can edit published grades"
                    description="Allow corrections after a quarter's grades are released"
                    checked={cfg.privileges.teacherEditPublished}
                    onChange={(v) =>
                      persistCfg({
                        ...cfg,
                        privileges: { ...cfg.privileges, teacherEditPublished: v },
                      })
                    }
                  />
                  <Toggle
                    label="Students can view class rank"
                    description="Expose percentile ranking on the student grade page"
                    checked={cfg.privileges.studentViewRank}
                    onChange={(v) =>
                      persistCfg({ ...cfg, privileges: { ...cfg.privileges, studentViewRank: v } })
                    }
                  />
                  <Toggle
                    label="Teachers can post announcements"
                    description="Let teachers broadcast to their own sections"
                    checked={cfg.privileges.teacherPostAnnouncements}
                    onChange={(v) =>
                      persistCfg({
                        ...cfg,
                        privileges: { ...cfg.privileges, teacherPostAnnouncements: v },
                      })
                    }
                  />
                  <Toggle
                    label="Guardian portal access"
                    description="Allow parent/guardian read-only accounts"
                    checked={cfg.privileges.guardianAccess}
                    onChange={(v) =>
                      persistCfg({ ...cfg, privileges: { ...cfg.privileges, guardianAccess: v } })
                    }
                  />
                </div>
              </Card>
            </>
          )}

          {/* ---------- Logs & Backups ---------- */}
          {tab === "logs" && (
            <>
              <Card className="p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-lg font-bold">Audit Trail</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={auditQuery}
                      onChange={(e) => setAuditQuery(e.target.value)}
                      placeholder="Search actions…"
                      aria-label="Search audit log"
                      className="rounded-xl border border-input bg-background/70 py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {filteredAudit.map((e, i) => (
                    <div key={e.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{e.action}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.detail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold">{e.actor}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(e.at)} {fmtTime(e.at)}
                        </p>
                      </div>
                      <Badge
                        tone={
                          e.role === "admin" ? "indigo" : e.role === "teacher" ? "sky" : "slate"
                        }
                      >
                        {e.role}
                      </Badge>
                    </div>
                  ))}
                  {filteredAudit.length === 0 && (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      No matching audit entries.
                    </p>
                  )}
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                  <Database className="h-5 w-5 text-primary" /> Backups & Export
                </h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    onClick={exportStudents}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" /> Students (CSV)
                  </button>
                  <button
                    onClick={exportGradebook}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" /> Gradebook (JSON)
                  </button>
                  <button
                    onClick={exportSchema}
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    <Download className="h-4 w-4" /> Schema Dump (SQL)
                  </button>
                </div>
              </Card>

              <Card className="border-rose-300/60 p-6 dark:border-rose-500/30">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-rose-700 dark:text-rose-300">
                  <Trash2 className="h-5 w-5" /> Data Reset Utilities
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Destructive actions — confirmation required.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setConfirmAction("reset")}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    Reset Mock Data to Default
                  </button>
                  <button
                    onClick={() => setConfirmAction("purge")}
                    className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    Purge Demo Attendance Logs
                  </button>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Destructive action confirmation */}
      <Modal
        open={confirmAction !== null}
        onClose={() => {
          setConfirmAction(null);
          setConfirmText("");
        }}
        title={confirmAction === "reset" ? "Reset Mock Data" : "Purge Attendance Logs"}
      >
        <p className="text-sm text-muted-foreground">
          {confirmAction === "reset"
            ? "This clears all locally stored preferences, settings, and audit history on this device. The active session is kept."
            : "This permanently deletes up to 100 recent demo attendance records from the database."}
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Type RESET to confirm
          </span>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESET"
            className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setConfirmAction(null);
              setConfirmText("");
            }}
            className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={runConfirmed}
            disabled={busy || confirmText !== "RESET"}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Working…" : "Confirm"}
          </button>
        </div>
      </Modal>

      {/* Role change confirmation */}
      <Modal
        open={roleChange !== null}
        onClose={() => setRoleChange(null)}
        title={
          roleChange?.next === "admin"
            ? "Promote to Administrator"
            : roleChange?.user.role === "admin"
              ? "Revoke Administrator Access"
              : "Confirm Role Change"
        }
      >
        {roleChange && (
          <>
            <div className="flex items-center gap-3">
              {roleChange.user.avatar_url ? (
                <img
                  src={roleChange.user.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <Initials name={roleChange.user.full_name} />
              )}
              <div>
                <p className="text-sm font-semibold">{roleChange.user.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleChange.user.email ?? roleChange.user.student_id ?? ""}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                <Badge
                  tone={
                    roleChange.user.role === "admin"
                      ? "indigo"
                      : roleChange.user.role === "teacher"
                        ? "sky"
                        : "slate"
                  }
                >
                  {ROLE_LABEL[roleChange.user.role]}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <Badge
                  tone={
                    roleChange.next === "admin"
                      ? "indigo"
                      : roleChange.next === "teacher"
                        ? "sky"
                        : "slate"
                  }
                >
                  {ROLE_LABEL[roleChange.next]}
                </Badge>
              </div>
            </div>
            <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {roleChangeMessage(roleChange.user, roleChange.next)}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRoleChange(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={applyRoleChange}
                disabled={roleBusy}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {roleBusy ? "Updating…" : `Make ${ROLE_LABEL[roleChange.next]}`}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* User removal confirmation (soft delete) */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Remove User">
        {deleteTarget && (
          <>
            <div className="flex items-center gap-3">
              {deleteTarget.avatar_url ? (
                <img
                  src={deleteTarget.avatar_url}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <Initials name={deleteTarget.full_name} />
              )}
              <div>
                <p className="text-sm font-semibold">{deleteTarget.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {deleteTarget.email ?? deleteTarget.student_id ?? ""}
                </p>
              </div>
              <Badge
                tone={
                  deleteTarget.role === "admin"
                    ? "indigo"
                    : deleteTarget.role === "teacher"
                      ? "sky"
                      : "slate"
                }
              >
                {ROLE_LABEL[deleteTarget.role]}
              </Badge>
            </div>
            <p className="mt-4 rounded-xl border border-rose-300/60 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              Are you sure you want to remove {deleteTarget.full_name}? This will revoke platform
              access and unenroll/unassign them from active courses.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Their grades, attendance, and submission history are preserved for school records.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={deleteBusy}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleteBusy ? "Removing…" : "Delete User"}
              </button>
            </div>
          </>
        )}
      </Modal>
    </AppShell>
  );
}
