/*
 * Settings persistence for MSU-IIT IDS Online Workspace (MIOW).
 * UI preferences, hardware/kiosk config, and the audit trail are kept in
 * localStorage (demo "mock persistent state"); real profile fields are
 * saved through the server API in lms.ts.
 */

export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";

export const THEME_KEY = "northview-theme";
const FONT_KEY = "northview-fontsize";
const CONTRAST_KEY = "northview-contrast";
const ADMIN_CFG_KEY = "northview-admin-config";
const AUDIT_KEY = "northview-audit-log";
const SESSION_KEY = "northview-lms-session";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode */
  }
}

/* ---------- Appearance ---------- */

export function getThemeMode(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

export function applyThemeMode(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function getFontSize(): FontSize {
  try {
    const f = localStorage.getItem(FONT_KEY);
    if (f === "small" || f === "medium" || f === "large") return f;
  } catch {
    /* ignore */
  }
  return "medium";
}

export function applyFontSize(size: FontSize) {
  const el = document.documentElement;
  el.classList.toggle("font-small", size === "small");
  el.classList.toggle("font-large", size === "large");
  try {
    localStorage.setItem(FONT_KEY, size);
  } catch {
    /* ignore */
  }
}

export function getHighContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST_KEY) === "1";
  } catch {
    return false;
  }
}

export function applyHighContrast(on: boolean) {
  document.documentElement.classList.toggle("high-contrast", on);
  try {
    localStorage.setItem(CONTRAST_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/* ---------- Per-user settings ---------- */

export interface UserSettings {
  phone: string;
  address: string;
  avatar: string | null;
  notif: {
    deadline24h: boolean;
    deadline1h: boolean;
    gradeReleased: boolean;
    attendanceConfirm: boolean;
    urgentBroadcast: boolean;
  };
  channels: { email: boolean; inApp: boolean; push: boolean };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  phone: "",
  address: "",
  avatar: null,
  notif: {
    deadline24h: true,
    deadline1h: true,
    gradeReleased: true,
    attendanceConfirm: false,
    urgentBroadcast: true,
  },
  channels: { email: true, inApp: true, push: false },
};

const userKey = (id: string) => `northview-settings-${id}`;

export function getUserSettings(profileId: string): UserSettings {
  const saved = readJson<Partial<UserSettings>>(userKey(profileId)) ?? {};
  return {
    ...DEFAULT_USER_SETTINGS,
    ...saved,
    notif: { ...DEFAULT_USER_SETTINGS.notif, ...(saved.notif ?? {}) },
    channels: { ...DEFAULT_USER_SETTINGS.channels, ...(saved.channels ?? {}) },
  };
}

export function saveUserSettings(profileId: string, s: UserSettings) {
  writeJson(userKey(profileId), s);
}

/* ---------- Faculty (teacher) settings ---------- */

export interface TeacherSettings {
  prefix: string;
  department: string;
  bio: string;
  officeHours: string;
  /** Default grace period (minutes) applied to new course schedules. */
  lateThreshold: number;
  /** Defaults applied when creating a new worksheet/assignment. */
  defaultMaxAttempts: number;
  defaultScorePolicy: "highest_score" | "latest_score" | "average_score";
  allowRetakesByDefault: boolean;
  notif: {
    submissionEmail: boolean;
    submissionInApp: boolean;
    lateAttendanceEmail: boolean;
    lateAttendanceInApp: boolean;
  };
}

export const DEFAULT_TEACHER_SETTINGS: TeacherSettings = {
  prefix: "",
  department: "",
  bio: "",
  officeHours: "",
  lateThreshold: 10,
  defaultMaxAttempts: 1,
  defaultScorePolicy: "highest_score",
  allowRetakesByDefault: false,
  notif: {
    submissionEmail: true,
    submissionInApp: true,
    lateAttendanceEmail: false,
    lateAttendanceInApp: true,
  },
};

const teacherKey = (id: string) => `northview-teacher-settings-${id}`;

export function getTeacherSettings(profileId: string): TeacherSettings {
  const saved = readJson<Partial<TeacherSettings>>(teacherKey(profileId)) ?? {};
  return {
    ...DEFAULT_TEACHER_SETTINGS,
    ...saved,
    notif: { ...DEFAULT_TEACHER_SETTINGS.notif, ...(saved.notif ?? {}) },
  };
}

export function saveTeacherSettings(profileId: string, s: TeacherSettings) {
  writeJson(teacherKey(profileId), s);
}

/* ---------- Admin configuration ---------- */

export interface AdminConfig {
  academicYear: string;
  activeQuarter: number;
  weights: { attendance: number; ww: number; exam: number; pt: number };
  passingThreshold: number;
  rfidPrefix: string;
  rfidSuffix: string;
  enterDelimiter: boolean;
  audioChime: boolean;
  overlayDuration: number;
  autoResetDelay: number;
  privileges: {
    teacherEditPublished: boolean;
    studentViewRank: boolean;
    teacherPostAnnouncements: boolean;
    guardianAccess: boolean;
  };
}

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  academicYear: "2025–2026",
  activeQuarter: 2,
  weights: { attendance: 10, ww: 20, exam: 30, pt: 40 },
  passingThreshold: 75,
  rfidPrefix: "",
  rfidSuffix: "",
  enterDelimiter: true,
  audioChime: true,
  overlayDuration: 3,
  autoResetDelay: 5,
  privileges: {
    teacherEditPublished: false,
    studentViewRank: false,
    teacherPostAnnouncements: true,
    guardianAccess: false,
  },
};

export function getAdminConfig(): AdminConfig {
  const saved = readJson<Partial<AdminConfig>>(ADMIN_CFG_KEY) ?? {};
  return {
    ...DEFAULT_ADMIN_CONFIG,
    ...saved,
    weights: { ...DEFAULT_ADMIN_CONFIG.weights, ...(saved.weights ?? {}) },
    privileges: { ...DEFAULT_ADMIN_CONFIG.privileges, ...(saved.privileges ?? {}) },
  };
}

export function saveAdminConfig(cfg: AdminConfig) {
  writeJson(ADMIN_CFG_KEY, cfg);
}

/* ---------- Audit trail ---------- */

export interface AuditEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  detail: string;
  at: string;
}

function seedAudit(): AuditEntry[] {
  // Production: no demo audit entries — return empty.
  return [];
}

export function listAudit(): AuditEntry[] {
  const existing = readJson<AuditEntry[]>(AUDIT_KEY);
  if (existing) return existing;
  const seed = seedAudit();
  writeJson(AUDIT_KEY, seed);
  return seed;
}

export function logAudit(action: string, detail: string) {
  let actor = "System";
  let role = "system";
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as { full_name?: string; role?: string }) : null;
    if (s?.full_name) {
      actor = s.full_name;
      role = s.role ?? "system";
    }
  } catch {
    /* ignore */
  }
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    actor,
    role,
    action,
    detail,
    at: new Date().toISOString(),
  };
  writeJson(AUDIT_KEY, [entry, ...listAudit()].slice(0, 200));
}

/* ---------- Downloads & reset ---------- */

export function toCsv(rows: Array<Array<string | number | null>>): string {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export function downloadFile(name: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Clear every northview-* localStorage key except the active session. */
export function resetLocalPreferences() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("northview-") && k !== SESSION_KEY) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
