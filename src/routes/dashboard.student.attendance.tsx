import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";
import { attendanceStreak, fmtDate, fmtTime, listAttendance, type AttendanceStatus } from "@/lib/lms";
import { AppShell, Badge, Card, EmptyState, STUDENT_NAV, attendanceTone, useProfile } from "@/components/lms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/student/attendance")({
  head: () => ({
    meta: [
      { title: "My Attendance | MIOW - MSU-IIT IDS Online Workspace" },
      { name: "description", content: "Your RFID tap-in and tap-out history and attendance streak." },
      { property: "og:title", content: "My Attendance | MIOW - MSU-IIT IDS Online Workspace" },
      { property: "og:description", content: "Your RFID tap-in and tap-out history and attendance streak." },
    ],
  }),
  component: AttendancePage,
});

const STATUS_DOT: Record<AttendanceStatus, string> = {
  "on-time": "bg-emerald-500",
  late: "bg-amber-500",
  excused: "bg-violet-500",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function AttendancePage() {
  const profile = useProfile(["student"]);
  const { data: logs } = useQuery({
    queryKey: ["attendance", profile?.id],
    queryFn: () => listAttendance(profile!.id),
    enabled: !!profile,
  });
  const [monthOffset, setMonthOffset] = useState(0);

  if (!profile) return null;

  const all = logs ?? [];
  const streak = attendanceStreak(all);
  const lateCount = all.filter((l) => l.status === "late" && l.scan_type === "in").length;
  const daysPresent = new Set(all.filter((l) => l.scan_type === "in").map((l) => new Date(l.timestamp).toDateString())).size;

  // Calendar model for the viewed month
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first offset
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const isCurrentMonth = monthOffset === 0;

  const statusByDay = new Map<number, AttendanceStatus>();
  for (const l of all) {
    if (l.scan_type !== "in") continue;
    const d = new Date(l.timestamp);
    if (d.getFullYear() === year && d.getMonth() === month) statusByDay.set(d.getDate(), l.status);
  }

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Attendance</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        Every tap of your RFID card at the campus gates is recorded here.
      </p>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Streak</p>
            <CalendarCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold">{streak} days</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Days Present</p>
          <p className="mt-2 font-display text-3xl font-bold">{daysPresent}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Times Late</p>
          <p
            className={cn(
              "mt-2 font-display text-3xl font-bold",
              lateCount > 0 && "text-amber-600 dark:text-amber-400",
            )}
          >
            {lateCount}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly calendar */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              aria-label="Previous month"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="font-display text-sm font-bold">
              {view.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
            </p>
            <button
              onClick={() => setMonthOffset((o) => o + 1)}
              disabled={isCurrentMonth}
              aria-label="Next month"
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((d) => (
              <p key={d} className="pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {d}
              </p>
            ))}
            {cells.map((day, i) => {
              if (day == null) return <div key={`blank-${i}`} />;
              const status = statusByDay.get(day);
              const isToday = isCurrentMonth && day === now.getDate();
              const isFuture = isCurrentMonth && day > now.getDate();
              return (
                <div
                  key={day}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-semibold",
                    status ? "bg-muted/80" : "text-muted-foreground",
                    isFuture && "opacity-35",
                    isToday && "ring-2 ring-primary",
                  )}
                >
                  {day}
                  <span className={cn("mt-0.5 h-1.5 w-1.5 rounded-full", status ? STATUS_DOT[status] : "bg-transparent")} />
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> On time
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Late
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-500" /> Excused
            </span>
          </div>
        </Card>

        {/* Recent taps */}
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">Recent taps</h2>
          {all.length === 0 ? (
            <EmptyState title="No attendance records yet" sub="Tap your ID at the gate kiosk to start your streak." />
          ) : (
            <Card className="max-h-[430px] divide-y divide-border overflow-y-auto">
              {all.slice(0, 40).map((l) => {
                const t = attendanceTone(l.status);
                return (
                  <div key={l.id} className="flex items-center gap-3 p-4">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl",
                        l.scan_type === "in"
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
                      )}
                    >
                      {l.scan_type === "in" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Tapped {l.scan_type === "in" ? "IN" : "OUT"}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(l.timestamp)} · {fmtTime(l.timestamp)}
                      </p>
                    </div>
                    {l.scan_type === "in" && <Badge tone={t.tone}>{t.label}</Badge>}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
