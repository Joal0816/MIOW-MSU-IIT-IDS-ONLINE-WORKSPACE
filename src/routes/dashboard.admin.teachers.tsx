// Admin Console → Teachers. Faculty directory with department filtering,
// course-load relations, hardware enrollment status, and admin-only
// create/edit/remove actions. All mutations route through the signed-token
// server functions in lms.functions.ts (tables are default-deny), and the
// role is forced to 'teacher' server-side.
import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, GraduationCap, KeyRound, Nfc, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTeacher,
  deleteProfile,
  enrollRfid,
  listTeacherDirectory,
  updateProfile,
  type TeacherRecord,
} from "@/lib/lms";
import {
  ADMIN_NAV,
  AppShell,
  Badge,
  Card,
  EmptyState,
  Modal,
  useProfile,
  useRfidScanner,
} from "@/components/lms";

export const Route = createFileRoute("/dashboard/admin/teachers")({
  head: () => ({
    meta: [
      { title: "Teachers | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content:
          "Faculty directory: manage teacher accounts, departments, course loads and kiosk hardware enrollment.",
      },
      { property: "og:title", content: "Teachers | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "Manage faculty accounts, departments, course loads and kiosk credentials.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeachersPage,
});

const PREFIXES = ["", "Dr.", "Prof.", "Mr.", "Ms.", "Mrs.", "Engr."];

const EMPTY_FORM = {
  prefix: "",
  full_name: "",
  email: "",
  employee_id: "",
  department: "",
  pin: "",
  rfid_uid: "",
};

const INPUT =
  "h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function TeachersPage() {
  const profile = useProfile(["admin"]);
  const qc = useQueryClient();
  const { data: teachers } = useQuery({
    queryKey: ["teacher-directory"],
    queryFn: listTeacherDirectory,
    enabled: !!profile,
  });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("all");
  const [selected, setSelected] = useState<TeacherRecord | null>(null);
  const [listening, setListening] = useState(false);

  // Hardware listener: an RFID tap while the Add-teacher modal is open fills
  // the UID field directly instead of requiring manual entry.
  useRfidScanner(
    useCallback((uid: string) => {
      setForm((f) => ({ ...f, rfid_uid: uid }));
      setListening(false);
      toast.success("Keycard captured.");
    }, []),
    open && listening,
  );

  const departments = useMemo(
    () =>
      Array.from(new Set((teachers ?? []).map((t) => t.department).filter(Boolean))) as string[],
    [teachers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (teachers ?? []).filter((t) => {
      if (dept !== "all" && (t.department ?? "") !== dept) return false;
      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        (t.email ?? "").toLowerCase().includes(q) ||
        (t.employee_id ?? "").toLowerCase().includes(q) ||
        (t.department ?? "").toLowerCase().includes(q) ||
        t.courses.some((c) => `${c.code} ${c.title}`.toLowerCase().includes(q))
      );
    });
  }, [teachers, search, dept]);

  if (!profile) return null;

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (
      !form.full_name.trim() ||
      !form.email.trim() ||
      !form.employee_id.trim() ||
      !form.department.trim()
    ) {
      toast.error("Name, email, employee ID and department are required.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!/^\d{4,6}$/.test(form.pin)) {
      toast.error("Temporary PIN must be 4–6 digits.");
      return;
    }
    if (form.rfid_uid && !/^\d{6,20}$/.test(form.rfid_uid)) {
      toast.error("RFID UID must be 6–20 digits.");
      return;
    }
    setSaving(true);
    try {
      await createTeacher({
        full_name: form.full_name.trim(),
        prefix: form.prefix || null,
        email: form.email.trim().toLowerCase(),
        employee_id: form.employee_id.trim(),
        department: form.department.trim(),
        pin: form.pin,
        rfid_uid: form.rfid_uid || null,
      });
      toast.success(`${form.prefix ? `${form.prefix} ` : ""}${form.full_name} added to faculty.`);
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["teacher-directory"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add teacher.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: TeacherRecord) => {
    const load = t.courses.length
      ? `\n\n${t.courses.length} course(s) will be left without a lead teacher.`
      : "";
    if (!confirm(`Remove ${t.full_name} from faculty?${load}`)) return;
    try {
      await deleteProfile(t.id);
      toast.success("Faculty member removed.");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["teacher-directory"] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      qc.invalidateQueries({ queryKey: ["courses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <AppShell nav={ADMIN_NAV} profile={profile} subtitle="Admin Console">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Admin Console <span aria-hidden="true">›</span> Teachers
          </p>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Teachers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {teachers?.length ?? 0} active faculty members
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add teacher
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search faculty"
            placeholder="Search name, employee ID, email, department or course…"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label="Filter by department"
          className={INPUT}
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={teachers?.length ? "No matches" : "No faculty yet"}
          sub={
            teachers?.length
              ? "Try a different search or department filter."
              : "Add your first teacher to start assigning course loads."
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-4">Faculty</th>
                <th className="p-4">Employee ID</th>
                <th className="p-4">Department</th>
                <th className="p-4">Courses</th>
                <th className="p-4">Hardware</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                      ) : (
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                          <GraduationCap className="h-4 w-4" />
                        </span>
                      )}
                      <div>
                        <p className="font-semibold">
                          {t.prefix ? `${t.prefix} ` : ""}
                          {t.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">{t.email ?? "No email"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs">{t.employee_id ?? "—"}</td>
                  <td className="p-4">
                    {t.department ? <Badge tone="indigo">{t.department}</Badge> : "—"}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.courses.length}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={t.has_rfid ? "green" : "amber"}>
                        {t.has_rfid ? "Card bound" : "No card"}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(t);
                      }}
                      aria-label={`Remove ${t.full_name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      title="Remove teacher"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Add teacher */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add a teacher">
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={form.prefix}
            onChange={set("prefix")}
            aria-label="Prefix"
            className={INPUT}
          >
            {PREFIXES.map((p) => (
              <option key={p || "none"} value={p}>
                {p || "No prefix"}
              </option>
            ))}
          </select>
          <input
            value={form.full_name}
            onChange={set("full_name")}
            placeholder="Full name *"
            className={INPUT}
          />
          <input
            value={form.email}
            onChange={set("email")}
            placeholder="Faculty email *"
            type="email"
            className={INPUT}
          />
          <input
            value={form.employee_id}
            onChange={set("employee_id")}
            placeholder="Employee ID * (e.g. FAC-2026-014)"
            className={INPUT}
          />
          <input
            value={form.department}
            onChange={set("department")}
            placeholder="Department / specialization *"
            className={`${INPUT} sm:col-span-2`}
          />
          <input
            value={form.pin}
            onChange={(e) =>
              setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))
            }
            placeholder="Temporary PIN * (4–6 digits)"
            inputMode="numeric"
            className={INPUT}
          />
          <div className="flex gap-2">
            <input
              value={form.rfid_uid}
              onChange={(e) =>
                setForm((f) => ({ ...f, rfid_uid: e.target.value.replace(/\D/g, "") }))
              }
              placeholder="RFID UID (optional)"
              inputMode="numeric"
              className={`${INPUT} flex-1`}
            />
            <button
              type="button"
              onClick={() => setListening((v) => !v)}
              className="h-11 shrink-0 rounded-xl border border-border bg-card px-3 text-sm font-semibold hover:bg-muted"
            >
              {listening ? "Listening…" : "Tap card"}
            </button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The account is created with the <strong>teacher</strong> role. Share the temporary PIN
          privately — it is hashed on the server and cannot be read back.
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add teacher"}
        </button>
      </Modal>

      <TeacherDetailModal
        teacher={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["teacher-directory"] });
          qc.invalidateQueries({ queryKey: ["teachers"] });
        }}
        onRemove={remove}
      />
    </AppShell>
  );
}

function TeacherDetailModal({
  teacher,
  onClose,
  onChanged,
  onRemove,
}: {
  teacher: TeacherRecord | null;
  onClose: () => void;
  onChanged: () => void;
  onRemove: (t: TeacherRecord) => void;
}) {
  const [prefix, setPrefix] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [newRfid, setNewRfid] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState<string | null>(null);

  // Seed the editable fields the first time a given faculty row is opened.
  if (teacher && hydrated !== teacher.id) {
    setHydrated(teacher.id);
    setPrefix(teacher.prefix ?? "");
    setName(teacher.full_name);
    setDept(teacher.department ?? "");
    setEmployeeId(teacher.employee_id ?? "");
    setNewRfid("");
    setNewPin("");
  }

  if (!teacher) return null;

  const saveDetails = async () => {
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile(teacher.id, {
        full_name: name.trim(),
        prefix: prefix || null,
        department: dept.trim() || null,
        employee_id: employeeId.trim() || null,
      });
      toast.success("Faculty record updated.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const rebind = async (kind: "rfid" | "pin") => {
    const value = kind === "rfid" ? newRfid.trim() : newPin.trim();
    const valid = kind === "rfid" ? /^\d{6,20}$/.test(value) : /^\d{4,8}$/.test(value);
    if (!valid) {
      toast.error(kind === "rfid" ? "RFID UID must be 6–20 digits." : "PIN must be 4–8 digits.");
      return;
    }
    setBusy(true);
    try {
      if (kind === "rfid") {
        await enrollRfid(teacher.id, { rfid_uid: value });
        setNewRfid("");
        toast.success("Keycard bound.");
      } else {
        await updateProfile(teacher.id, { pin: value });
        setNewPin("");
        toast.success("PIN reset.");
      }
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!teacher}
      onClose={onClose}
      title={`${teacher.prefix ?? ""} ${teacher.full_name}`.trim()}
    >
      <div className="mb-4 flex items-center gap-3">
        {teacher.avatar_url ? (
          <img
            src={teacher.avatar_url}
            alt=""
            className="h-14 w-14 rounded-full ring-2 ring-primary/30"
          />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <GraduationCap className="h-6 w-6" />
          </span>
        )}
        <div>
          <p className="text-sm font-semibold">{teacher.employee_id ?? "No employee ID"}</p>
          <p className="text-xs text-muted-foreground">{teacher.email ?? "No email"}</p>
          <Badge tone="indigo">{teacher.department ?? "Unassigned department"}</Badge>
        </div>
      </div>

      {/* Course load */}
      <div className="mb-4 rounded-xl bg-muted/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Course load
        </p>
        {teacher.courses.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No courses assigned yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {teacher.courses.map((c) => (
              <Badge key={c.id} tone="green">
                {c.code} · {c.title}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Editable identity */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          aria-label="Prefix"
          className={INPUT}
        >
          {PREFIXES.map((p) => (
            <option key={p || "none"} value={p}>
              {p || "No prefix"}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Full name"
          className={INPUT}
        />
        <input
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          aria-label="Employee ID"
          placeholder="Employee ID"
          className={INPUT}
        />
        <input
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          aria-label="Department"
          placeholder="Department"
          className={INPUT}
        />
      </div>
      <button
        onClick={saveDetails}
        disabled={busy}
        className="mb-5 h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        Save changes
      </button>

      {/* Credentials & hardware */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Credentials &amp; hardware
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Nfc className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={newRfid}
              onChange={(e) => setNewRfid(e.target.value.replace(/\D/g, ""))}
              placeholder={teacher.has_rfid ? "New RFID UID (card bound)" : "New RFID UID"}
              inputMode="numeric"
              aria-label="New RFID UID"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => rebind("rfid")}
            disabled={busy || !newRfid.trim()}
            className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Bind card
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder={teacher.has_pin ? "New PIN (already set)" : "New PIN"}
              inputMode="numeric"
              aria-label="New PIN"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => rebind("pin")}
            disabled={busy || !newPin.trim()}
            className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Reset PIN
          </button>
        </div>
      </div>

      <button
        onClick={() => onRemove(teacher)}
        className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
      >
        <Trash2 className="h-4 w-4" /> Remove from faculty
      </button>
    </Modal>
  );
}
