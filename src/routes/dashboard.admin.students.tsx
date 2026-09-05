import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Nfc, Plus, Search, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  attendancePercent,
  createProfile,
  deleteProfile,
  gradeRemarks,
  listAttendance,
  listGradesForStudent,
  listStudents,
  transmutedOf,
  updateProfile,
  type Profile,
} from "@/lib/lms";
import {
  ADMIN_NAV,
  AppShell,
  Badge,
  Card,
  EmptyState,
  Modal,
  staffNav,
  useProfile,
} from "@/components/lms";

export const Route = createFileRoute("/dashboard/admin/students")({
  head: () => ({
    meta: [
      { title: "Students | MIOW - Integrated Developmental School" },
      { name: "description", content: "Manage student records, RFID cards and sections." },
      { property: "og:title", content: "Students | MIOW - Integrated Developmental School" },
      { property: "og:description", content: "Manage student records, RFID cards and sections." },
    ],
  }),
  component: StudentsPage,
});

const AVATARS = [
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Milo",
  "https://api.dicebear.com/9.x/adventurer/svg?seed=Luna",
];

const EMPTY_FORM = {
  full_name: "",
  student_id: "",
  email: "",
  grade_level: "7",
  section: "",
  pin: "",
  rfid_uid: "",
};

function StudentsPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [selected, setSelected] = useState<Profile | null>(null);

  const sections = useMemo(() => {
    const set = new Set((students ?? []).map((s) => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      if (gradeFilter !== "all" && s.grade_level !== parseInt(gradeFilter)) return false;
      if (sectionFilter !== "all" && s.section !== sectionFilter) return false;
      if (!q) return true;
      return (
        s.full_name.toLowerCase().includes(q) ||
        (s.student_id ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.section ?? "").toLowerCase().includes(q)
      );
    });
  }, [students, search, gradeFilter, sectionFilter]);

  if (!profile) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.full_name || !form.student_id) {
      toast.error("Name and student number are required.");
      return;
    }
    setSaving(true);
    try {
      await createProfile({
        full_name: form.full_name,
        student_id: form.student_id,
        email: form.email || null,
        role: "student",
        grade_level: parseInt(form.grade_level) || 7,
        section: form.section || null,
        pin: form.pin || null,
        rfid_uid: form.rfid_uid || null,
        avatar_url: AVATARS[Math.floor(Math.random() * AVATARS.length)] ?? null,
      });
      toast.success(`${form.full_name} enrolled.`);
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch {
      toast.error("Could not save student.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? This deletes their records.`)) return;
    try {
      await deleteProfile(id);
      toast.success("Student removed.");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch {
      toast.error("Delete failed.");
    }
  };

  return (
    <AppShell
      nav={staffNav(profile.role)}
      profile={profile}
      subtitle={profile.role === "admin" ? "Admin Console" : "Teacher Portal"}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {students?.length ?? 0} enrolled learners
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add student
        </button>
      </div>

      {/* Search + grade filter */}
      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, student no., email or section…"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="h-11 w-[160px] rounded-xl">
            <SelectValue placeholder="All grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {[7, 8, 9, 10, 11, 12].map((g) => (
              <SelectItem key={g} value={String(g)}>
                Grade {g}
              </SelectItem>
            ))}
            {[13, 14, 15, 16].map((g) => (
              <SelectItem key={g} value={String(g)}>
                College Yr{g - 12}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="h-11 w-[160px] rounded-xl">
            <SelectValue placeholder="All sections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {sections.map((sec) => (
              <SelectItem key={sec} value={sec!}>
                {sec}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={students?.length ? "No matches" : "No students yet"}
          sub={
            students?.length
              ? "Try a different search or filter."
              : "Enroll your first student to get started."
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-4">Student</th>
                <th className="p-4">Student No.</th>
                <th className="p-4">Grade &amp; Section</th>
                <th className="p-4">RFID UID</th>
                <th className="p-4">PIN</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      <img src={s.avatar_url ?? ""} alt="" className="h-8 w-8 rounded-full" />
                      <div>
                        <p className="font-semibold">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">{s.student_id}</td>
                  <td className="p-4">
                    <Badge tone="indigo">
                      G{s.grade_level} · {s.section}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-xs">{s.has_rfid ? "••••••••" : "—"}</td>
                  <td className="p-4 font-mono text-xs">{s.has_pin ? "••••" : "—"}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(s.id, s.full_name);
                      }}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                      title="Remove student"
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

      {/* Add student */}
      <Modal open={open} onClose={() => setOpen(false)} title="Enroll a student">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={form.full_name}
            onChange={set("full_name")}
            placeholder="Full name *"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring sm:col-span-2"
          />
          <input
            value={form.student_id}
            onChange={set("student_id")}
            placeholder="Student number * (e.g. 2026-0042)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.email}
            onChange={set("email")}
            placeholder="Email"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Select
            value={form.grade_level}
            onValueChange={(v) => setForm((f) => ({ ...f, grade_level: v }))}
          >
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue placeholder="Grade level" />
            </SelectTrigger>
            <SelectContent>
              {[7, 8, 9, 10, 11, 12].map((g) => (
                <SelectItem key={g} value={String(g)}>
                  Grade {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            value={form.section}
            onChange={set("section")}
            placeholder="Section (e.g. Rizal)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.pin}
            onChange={set("pin")}
            placeholder="PIN (4–8 digits)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={form.rfid_uid}
            onChange={set("rfid_uid")}
            placeholder="RFID UID (6–20 digits)"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Enroll student"}
        </button>
      </Modal>

      {/* Student profile + rebind */}
      <StudentProfileModal
        student={selected}
        onClose={() => setSelected(null)}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["students"] });
          qc.invalidateQueries({ queryKey: ["grades"] });
        }}
      />
    </AppShell>
  );
}

function StudentProfileModal({
  student,
  onClose,
  onChanged,
}: {
  student: Profile | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newRfid, setNewRfid] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: grades } = useQuery({
    queryKey: ["student-grades", student?.id],
    queryFn: () => listGradesForStudent(student!.id),
    enabled: !!student,
  });
  const { data: logs } = useQuery({
    queryKey: ["attendance", student?.id],
    queryFn: () => listAttendance(student!.id),
    enabled: !!student,
  });

  if (!student) return null;

  const att = attendancePercent(logs ?? []);
  const transmuted = (grades ?? [])
    .map((g) => transmutedOf(g, att))
    .filter((t): t is number => t != null);
  const gwa = transmuted.length
    ? Math.round((transmuted.reduce((a, b) => a + b, 0) / transmuted.length) * 10) / 10
    : null;

  const rebind = async (kind: "rfid" | "pin") => {
    const value = kind === "rfid" ? newRfid.trim() : newPin.trim();
    const valid = kind === "rfid" ? /^\d{6,20}$/.test(value) : /^\d{4,8}$/.test(value);
    if (!valid) {
      toast.error(kind === "rfid" ? "RFID UID must be 6–20 digits." : "PIN must be 4–8 digits.");
      return;
    }
    setBusy(true);
    try {
      await updateProfile(student.id, kind === "rfid" ? { rfid_uid: value } : { pin: value });
      toast.success(kind === "rfid" ? "RFID card rebound." : "PIN reset.");
      if (kind === "rfid") setNewRfid("");
      else setNewPin("");
      onChanged();
    } catch {
      toast.error("Update failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!student} onClose={onClose} title={student.full_name}>
      <div className="mb-4 flex items-center gap-3">
        <img
          src={student.avatar_url ?? ""}
          alt=""
          className="h-14 w-14 rounded-full ring-2 ring-primary/30"
        />
        <div>
          <p className="text-sm font-semibold">{student.student_id}</p>
          <p className="text-xs text-muted-foreground">{student.email ?? "No email"}</p>
          <Badge tone="indigo">
            Grade {student.grade_level} · {student.section ?? "—"}
          </Badge>
        </div>
      </div>

      {/* Academic standing */}
      <div className="mb-4 rounded-xl bg-muted/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Academic standing
        </p>
        {gwa == null ? (
          <p className="mt-1 text-sm text-muted-foreground">No grades encoded yet.</p>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <p className="font-display text-2xl font-bold">{gwa}</p>
            <Badge tone={gwa >= 90 ? "green" : gwa >= 80 ? "indigo" : gwa >= 75 ? "amber" : "red"}>
              {gradeRemarks(gwa)}
            </Badge>
            <p className="text-xs text-muted-foreground">
              GWA across {transmuted.length} course grade(s)
            </p>
          </div>
        )}
      </div>

      {/* Credential rebinding */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Credentials
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Nfc className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={newRfid}
              onChange={(e) => setNewRfid(e.target.value.replace(/\D/g, ""))}
              placeholder={student.has_rfid ? "New RFID UID (card bound)" : "New RFID UID"}
              inputMode="numeric"
              className="h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => rebind("rfid")}
            disabled={busy || !newRfid.trim()}
            className="h-10 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            Rebind card
          </button>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder={student.has_pin ? "New PIN (already set)" : "New PIN"}
              inputMode="numeric"
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
    </Modal>
  );
}
