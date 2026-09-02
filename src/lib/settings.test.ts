/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import {
  getThemeMode,
  applyThemeMode,
  getFontSize,
  applyFontSize,
  getHighContrast,
  applyHighContrast,
  getUserSettings,
  saveUserSettings,
  getTeacherSettings,
  saveTeacherSettings,
  getAdminConfig,
  saveAdminConfig,
  listAudit,
  logAudit,
  toCsv,
  resetLocalPreferences,
  DEFAULT_USER_SETTINGS,
  DEFAULT_TEACHER_SETTINGS,
  DEFAULT_ADMIN_CONFIG,
  THEME_KEY,
  type UserSettings,
  type TeacherSettings,
  type AdminConfig,
} from "./settings";

// Polyfill minimal localStorage + document for bun test environment
const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
  get length() {
    return Object.keys(store).length;
  },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// Inject into globalThis so the module's closures pick it up
(globalThis as any).localStorage = mockLocalStorage;

// Minimal document mock for applyThemeMode / applyFontSize / applyHighContrast
const classList = new Set<string>();
(globalThis as any).document = {
  documentElement: {
    classList: {
      toggle: (cls: string, force?: boolean) => {
        if (force === undefined) {
          if (classList.has(cls)) {
            classList.delete(cls);
          } else {
            classList.add(cls);
          }
        } else if (force) {
          classList.add(cls);
        } else {
          classList.delete(cls);
        }
      },
    },
  },
};

// Minimal matchMedia mock
(globalThis as any).window = {
  matchMedia: () => ({ matches: false }),
};

beforeEach(() => {
  mockLocalStorage.clear();
  classList.clear();
});

// ── Theme ───────────────────────────────────────────────────────────

describe("getThemeMode", () => {
  it("returns 'system' when nothing is stored", () => {
    expect(getThemeMode()).toBe("system");
  });

  it("returns stored value when valid", () => {
    mockLocalStorage.setItem(THEME_KEY, "dark");
    expect(getThemeMode()).toBe("dark");
  });

  it("returns 'system' for invalid stored value", () => {
    mockLocalStorage.setItem(THEME_KEY, "invalid");
    expect(getThemeMode()).toBe("system");
  });
});

describe("applyThemeMode", () => {
  it("persists the mode to localStorage", () => {
    applyThemeMode("dark");
    expect(mockLocalStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("toggles 'dark' class on documentElement for dark mode", () => {
    applyThemeMode("dark");
    expect(classList.has("dark")).toBe(true);
  });

  it("removes 'dark' class for light mode", () => {
    classList.add("dark");
    applyThemeMode("light");
    expect(classList.has("dark")).toBe(false);
  });
});

// ── Font Size ───────────────────────────────────────────────────────

describe("getFontSize", () => {
  it("returns 'medium' by default", () => {
    expect(getFontSize()).toBe("medium");
  });

  it("returns stored valid value", () => {
    mockLocalStorage.setItem("northview-fontsize", "large");
    expect(getFontSize()).toBe("large");
  });

  it("returns 'medium' for invalid value", () => {
    mockLocalStorage.setItem("northview-fontsize", "huge");
    expect(getFontSize()).toBe("medium");
  });
});

describe("applyFontSize", () => {
  it("sets font-small class for small", () => {
    applyFontSize("small");
    expect(classList.has("font-small")).toBe(true);
    expect(classList.has("font-large")).toBe(false);
  });

  it("sets font-large class for large", () => {
    applyFontSize("large");
    expect(classList.has("font-large")).toBe(true);
    expect(classList.has("font-small")).toBe(false);
  });

  it("removes both classes for medium", () => {
    classList.add("font-small");
    applyFontSize("medium");
    expect(classList.has("font-small")).toBe(false);
    expect(classList.has("font-large")).toBe(false);
  });

  it("persists to localStorage", () => {
    applyFontSize("small");
    expect(mockLocalStorage.getItem("northview-fontsize")).toBe("small");
  });
});

// ── High Contrast ───────────────────────────────────────────────────

describe("getHighContrast", () => {
  it("returns false by default", () => {
    expect(getHighContrast()).toBe(false);
  });

  it("returns true when stored as '1'", () => {
    mockLocalStorage.setItem("northview-contrast", "1");
    expect(getHighContrast()).toBe(true);
  });

  it("returns false when stored as '0'", () => {
    mockLocalStorage.setItem("northview-contrast", "0");
    expect(getHighContrast()).toBe(false);
  });
});

describe("applyHighContrast", () => {
  it("toggles high-contrast class on", () => {
    applyHighContrast(true);
    expect(classList.has("high-contrast")).toBe(true);
  });

  it("toggles high-contrast class off", () => {
    classList.add("high-contrast");
    applyHighContrast(false);
    expect(classList.has("high-contrast")).toBe(false);
  });

  it("persists '1' when on", () => {
    applyHighContrast(true);
    expect(mockLocalStorage.getItem("northview-contrast")).toBe("1");
  });

  it("persists '0' when off", () => {
    applyHighContrast(false);
    expect(mockLocalStorage.getItem("northview-contrast")).toBe("0");
  });
});

// ── User Settings ───────────────────────────────────────────────────

describe("getUserSettings", () => {
  it("returns defaults when nothing stored", () => {
    const s = getUserSettings("user-1");
    expect(s).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("merges partial saved settings with defaults", () => {
    const partial: Partial<UserSettings> = { phone: "09171234567" };
    mockLocalStorage.setItem("northview-settings-user-1", JSON.stringify(partial));
    const s = getUserSettings("user-1");
    expect(s.phone).toBe("09171234567");
    expect(s.address).toBe(DEFAULT_USER_SETTINGS.address);
  });

  it("deep-merges notif sub-object", () => {
    const partial: Partial<UserSettings> = {
      notif: { deadline24h: false } as any,
    };
    mockLocalStorage.setItem("northview-settings-user-1", JSON.stringify(partial));
    const s = getUserSettings("user-1");
    expect(s.notif.deadline24h).toBe(false);
    expect(s.notif.gradeReleased).toBe(DEFAULT_USER_SETTINGS.notif.gradeReleased);
  });

  it("returns different settings per profile ID", () => {
    mockLocalStorage.setItem("northview-settings-user-a", JSON.stringify({ phone: "111" }));
    mockLocalStorage.setItem("northview-settings-user-b", JSON.stringify({ phone: "222" }));
    expect(getUserSettings("user-a").phone).toBe("111");
    expect(getUserSettings("user-b").phone).toBe("222");
  });
});

describe("saveUserSettings", () => {
  it("persists settings to localStorage", () => {
    const settings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      phone: "0999",
    };
    saveUserSettings("user-1", settings);
    const raw = mockLocalStorage.getItem("northview-settings-user-1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).phone).toBe("0999");
  });
});

// ── Teacher Settings ────────────────────────────────────────────────

describe("getTeacherSettings", () => {
  it("returns defaults when nothing stored", () => {
    const s = getTeacherSettings("t-1");
    expect(s).toEqual(DEFAULT_TEACHER_SETTINGS);
  });

  it("merges partial saved settings with defaults", () => {
    const partial: Partial<TeacherSettings> = { prefix: "Prof." };
    mockLocalStorage.setItem("northview-teacher-settings-t-1", JSON.stringify(partial));
    const s = getTeacherSettings("t-1");
    expect(s.prefix).toBe("Prof.");
    expect(s.lateThreshold).toBe(DEFAULT_TEACHER_SETTINGS.lateThreshold);
  });

  it("deep-merges notif sub-object", () => {
    const partial: Partial<TeacherSettings> = {
      notif: { submissionEmail: false } as any,
    };
    mockLocalStorage.setItem("northview-teacher-settings-t-1", JSON.stringify(partial));
    const s = getTeacherSettings("t-1");
    expect(s.notif.submissionEmail).toBe(false);
    expect(s.notif.lateAttendanceInApp).toBe(DEFAULT_TEACHER_SETTINGS.notif.lateAttendanceInApp);
  });
});

describe("saveTeacherSettings", () => {
  it("persists settings to localStorage", () => {
    const settings: TeacherSettings = {
      ...DEFAULT_TEACHER_SETTINGS,
      prefix: "Dr.",
    };
    saveTeacherSettings("t-1", settings);
    const raw = mockLocalStorage.getItem("northview-teacher-settings-t-1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).prefix).toBe("Dr.");
  });
});

// ── Admin Config ────────────────────────────────────────────────────

describe("getAdminConfig", () => {
  it("returns defaults when nothing stored", () => {
    const c = getAdminConfig();
    expect(c).toEqual(DEFAULT_ADMIN_CONFIG);
  });

  it("merges partial saved config with defaults", () => {
    const partial: Partial<AdminConfig> = { passingThreshold: 80 };
    mockLocalStorage.setItem("northview-admin-config", JSON.stringify(partial));
    const c = getAdminConfig();
    expect(c.passingThreshold).toBe(80);
    expect(c.weights).toEqual(DEFAULT_ADMIN_CONFIG.weights);
  });

  it("deep-merges weights sub-object", () => {
    const partial: Partial<AdminConfig> = {
      weights: { attendance: 5 } as any,
    };
    mockLocalStorage.setItem("northview-admin-config", JSON.stringify(partial));
    const c = getAdminConfig();
    expect(c.weights.attendance).toBe(5);
    expect(c.weights.ww).toBe(DEFAULT_ADMIN_CONFIG.weights.ww);
  });

  it("deep-merges privileges sub-object", () => {
    const partial: Partial<AdminConfig> = {
      privileges: { guardianAccess: true } as any,
    };
    mockLocalStorage.setItem("northview-admin-config", JSON.stringify(partial));
    const c = getAdminConfig();
    expect(c.privileges.guardianAccess).toBe(true);
    expect(c.privileges.teacherEditPublished).toBe(
      DEFAULT_ADMIN_CONFIG.privileges.teacherEditPublished,
    );
  });
});

describe("saveAdminConfig", () => {
  it("persists config to localStorage", () => {
    const cfg: AdminConfig = { ...DEFAULT_ADMIN_CONFIG, passingThreshold: 70 };
    saveAdminConfig(cfg);
    const raw = mockLocalStorage.getItem("northview-admin-config");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).passingThreshold).toBe(70);
  });
});

// ── Audit Trail ─────────────────────────────────────────────────────

describe("listAudit", () => {
  it("returns empty array when nothing stored", () => {
    expect(listAudit()).toEqual([]);
  });

  it("returns previously stored entries", () => {
    const entries = [
      {
        id: "1",
        actor: "Admin",
        role: "admin",
        action: "create",
        detail: "Created course",
        at: "2025-01-01T00:00:00Z",
      },
    ];
    mockLocalStorage.setItem("northview-audit-log", JSON.stringify(entries));
    expect(listAudit()).toEqual(entries);
  });
});

describe("logAudit", () => {
  it("appends an entry with actor from session", () => {
    mockLocalStorage.setItem(
      "northview-lms-session",
      JSON.stringify({ full_name: "Juan Dela Cruz", role: "teacher" }),
    );
    logAudit("update", "Updated grade");
    const entries = listAudit();
    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.actor).toBe("Juan Dela Cruz");
    expect(entry.role).toBe("teacher");
    expect(entry.action).toBe("update");
    expect(entry.detail).toBe("Updated grade");
  });

  it("uses 'System' when no session exists", () => {
    logAudit("system_event", "Backup completed");
    const entries = listAudit();
    const entry = entries[0]!;
    expect(entry.actor).toBe("System");
    expect(entry.role).toBe("system");
  });

  it("caps entries at 200", () => {
    // Seed 200 entries
    const entries = Array.from({ length: 200 }, (_, i) => ({
      id: String(i),
      actor: "A",
      role: "r",
      action: "a",
      detail: "d",
      at: "2025-01-01T00:00:00Z",
    }));
    mockLocalStorage.setItem("northview-audit-log", JSON.stringify(entries));
    logAudit("new", "one more");
    expect(listAudit()).toHaveLength(200);
  });
});

// ── toCsv ───────────────────────────────────────────────────────────

describe("toCsv", () => {
  it("converts a simple 2D array", () => {
    const rows = [
      ["Name", "Score"],
      ["Alice", 95],
      ["Bob", 88],
    ];
    expect(toCsv(rows)).toBe('"Name","Score"\n"Alice","95"\n"Bob","88"');
  });

  it("escapes double quotes", () => {
    const rows = [['He said "hello"', 1]];
    expect(toCsv(rows)).toBe('"He said ""hello""","1"');
  });

  it("handles null values as empty strings", () => {
    const rows = [["A", null, "C"]];
    expect(toCsv(rows)).toBe('"A","","C"');
  });

  it("handles empty array", () => {
    expect(toCsv([])).toBe("");
  });

  it("handles single row", () => {
    expect(toCsv([["x", "y"]])).toBe('"x","y"');
  });
});

// ── resetLocalPreferences ───────────────────────────────────────────

describe("resetLocalPreferences", () => {
  it("removes all northview-* keys except session", () => {
    mockLocalStorage.setItem("northview-theme", "dark");
    mockLocalStorage.setItem("northview-fontsize", "large");
    mockLocalStorage.setItem("northview-lms-session", '{"user":"test"}');
    mockLocalStorage.setItem("other-key", "keep");

    resetLocalPreferences();

    expect(mockLocalStorage.getItem("northview-theme")).toBeNull();
    expect(mockLocalStorage.getItem("northview-fontsize")).toBeNull();
    expect(mockLocalStorage.getItem("northview-lms-session")).toBe('{"user":"test"}');
    expect(mockLocalStorage.getItem("other-key")).toBe("keep");
  });

  it("does nothing when no northview keys exist", () => {
    mockLocalStorage.setItem("unrelated", "value");
    resetLocalPreferences();
    expect(mockLocalStorage.getItem("unrelated")).toBe("value");
  });
});
