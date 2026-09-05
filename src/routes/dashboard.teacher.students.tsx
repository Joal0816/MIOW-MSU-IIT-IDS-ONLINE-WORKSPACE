import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  attendancePercent,
  listAttendance,
  listCourses,
  listGradesForStudent,
  listStudents,
  transmutedOf,
  type Profile,
} from "@/lib/lms";
import {
  AppShell,
  Badge,
  Card,
  EmptyState,
  Modal,
  TEACHER_NAV,
  useProfile,
} from "@/components/lms";

export const Route = createFileRoute("/dashboard/teacher/students")({
  head: () => ({
    meta: [
      { title: "Students Info | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Students in your courses — grades, attendance and sections.",
      },
      { property: "og:title", content: "Students Info | MIOW - Integrated Developmental School" },
    ],
  }),
  component: TeacherStudentsPage,
});

function TeacherStudentsPage() {
  const profile = useProfile(["teacher", "admin"]);
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: listCourses,
    enabled: !!profile,
  });

  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [selected, setSelected] = useState<Profile | null>(null);

  const sections = useMemo(() => {
    const set = new Set((students ?? []).map((s) => s.section).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  // Teacher's own courses; admin sees all
  const teacherCourses = useMemo(() => {
    if (!profile || !courses) return [];
    if (profile.role === "admin") return courses;
    return courses.filter((c) => c.teacher_id === profile.id);
  }, [profile, courses]);

  // For now Students Info is not enrollment-filtered (enrollments table is separate) —
  // teacher sees all students but with a hint about their course count.
  // Future: fetch enrollmentsForCourse per teacherCourses and filter studentIds.
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

  return (
    <AppShell nav={TEACHER_NAV} profile={profile} subtitle="Teacher Portal">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Students Info</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.role === "admin"
              ? `${filtered.length} of ${students?.length ?? 0} enrolled learners`
              : `${filtered.length} of ${students?.length ?? 0} learners · ${teacherCourses.length} courses you lead`}
          </p>
        </div>
      </div>

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
            {[7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((g) => (
              <SelectItem key={g} value={String(g)}>
                {g <= 12 ? `Grade ${g}` : `College Yr${g - 12}`}
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
              : teacherCourses.length === 0
                ? "You are not leading any courses yet."
                : "No students enrolled in your courses yet."
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-4">Student</th>
                <th className="p-4">Student No.</th>
                <th className="p-4">Grade & Section</th>
                <th className="p-4">RFID</th>
                <th className="p-4">Attendance</th>
                <th className="p-4">GWA</th>
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
                      G{s.grade_level} · {s.section ?? "—"}
                    </Badge>
                  </td>
                  <td className="p-4 font-mono text-xs">{s.has_rfid ? "••••••••" : "—"}</td>
                  <td className="p-4">
                    <AttendanceCell studentId={s.id} />
                  </td>
                  <td className="p-4">
                    <GwaCell studentId={s.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <StudentInfoModal student={selected} onClose={() => setSelected(null)} />
    </AppShell>
  );
}

function AttendanceCell({ studentId }: { studentId: string }) {
  const { data: logs } = useQuery({
    queryKey: ["attendance", studentId],
    queryFn: () => listAttendance(studentId),
  });
  if (!logs) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = attendancePercent(logs);
  return <span className="text-xs font-semibold">{pct != null ? `${pct}%` : "—"}</span>;
}

function GwaCell({ studentId }: { studentId: string }) {
  const { data: grades } = useQuery({
    queryKey: ["student-grades", studentId],
    queryFn: () => listGradesForStudent(studentId),
  });
  const { data: logs } = useQuery({
    queryKey: ["attendance", studentId],
    queryFn: () => listAttendance(studentId),
  });
  if (!grades) return <span className="text-xs text-muted-foreground">—</span>;
  const att = attendancePercent(logs ?? []);
  const transmuted = grades.map((g) => transmutedOf(g, att)).filter((t): t is number => t != null);
  const gwa = transmuted.length
    ? Math.round((transmuted.reduce((a, b) => a + b, 0) / transmuted.length) * 10) / 10
    : null;
  return <span className="text-xs font-semibold">{gwa ?? "—"}</span>;
}

function StudentInfoModal({ student, onClose }: { student: Profile | null; onClose: () => void }) {
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
      <div className="rounded-xl bg-muted/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Academic standing
        </p>
        {gwa == null ? (
          <p className="mt-1 text-sm text-muted-foreground">No grades encoded yet.</p>
        ) : (
          <div className="mt-1 flex items-center gap-3">
            <p className="font-display text-2xl font-bold">{gwa}</p>
            <Badge tone={gwa >= 90 ? "green" : gwa >= 80 ? "indigo" : gwa >= 75 ? "amber" : "red"}>
              {gwa >= 90
                ? "Outstanding"
                : gwa >= 85
                  ? "Very Satisfactory"
                  : gwa >= 80
                    ? "Satisfactory"
                    : gwa >= 75
                      ? "Fairly Satisfactory"
                      : "Did Not Meet Expectations"}
            </Badge>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Attendance: {att != null ? `${att}%` : "—"} · {logs?.length ?? 0} log(s)
        </p>
      </div>
    </Modal>
  );
}
