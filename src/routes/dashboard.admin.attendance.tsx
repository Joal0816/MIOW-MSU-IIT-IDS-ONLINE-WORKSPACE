import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, LogOut, Nfc, Trash2, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  createMockTapPayload,
  deleteAttendanceLog,
  fmtTime,
  listAllAttendance,
  listStudents,
  recordTap,
  updateAttendanceLog,
  type AttendanceStatus,
  type Profile,
  type TapPayload,
  type TapResult,
} from "@/lib/lms";
import {
  TEACHER_NAV,
  AppShell,
  Badge,
  Card,
  FilterTabs,
  attendanceTone,
  useProfile,
  useRfidScanner,
} from "@/components/lms";
import { cn } from "@/lib/utils";
import { KIOSK_EVENT_HEADER, KIOSK_TITLE } from "@/lib/brand";
import { MiowMark } from "@/components/brand";

export const Route = createFileRoute("/dashboard/admin/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance Kiosk | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Gate kiosk: RFID tap-in/tap-out with live feed.",
      },
      { property: "og:title", content: "Attendance Kiosk | MIOW - Integrated Developmental School" },
      {
        property: "og:description",
        content: "Gate kiosk: RFID tap-in/tap-out with live feed.",
      },
    ],
  }),
  component: AttendanceKiosk,
});

type FeedFilter = "all" | "in" | "out" | "late";

/** Short confirmation tone — success chirp or error buzz. */
function playTone(ok: boolean, muted: boolean) {
  if (muted) return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = ok ? [660, 990] : [220, 180];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = ok ? "sine" : "square";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.14);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio unavailable */
  }
}

function AttendanceKiosk() {
  const profile = useProfile(["teacher"]);
  const qc = useQueryClient();
  const { data: logs } = useQuery({
    queryKey: ["attendance-all"],
    queryFn: () => listAllAttendance(60),
    enabled: !!profile,
  });
  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: listStudents,
    enabled: !!profile,
  });

  const [uid, setUid] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [lastScan, setLastScan] = useState<{
    profile: Profile;
    scan_type: "in" | "out";
    status: string;
    course?: TapResult["course"];
  } | null>(null);

  // Auto-dismiss the scan banner
  useEffect(() => {
    if (!lastScan) return;
    const t = setTimeout(() => setLastScan(null), 4000);
    return () => clearTimeout(t);
  }, [lastScan]);

  /** Process one reader payload ({ uid, timestamp }) — shared by the hardware
   * scanner, the manual form, and the simulated mock reader. */
  const handleTapPayload = async (payload: TapPayload, mock = false) => {
    if (busy) return;
    setBusy(true);
    if (mock) {
      // UI status feedback that the mock dispatcher's payload was received.
      toast.info(`Mock tap received — ${payload.uid}`, {
        description: `Dispatched ${new Date(payload.timestamp).toLocaleTimeString()}`,
      });
    }
    try {
      const result = await recordTap({ uid: payload.uid.trim(), timestamp: payload.timestamp });
      if (!result) {
        playTone(false, muted);
        toast.error(`Card not recognized (${payload.uid.trim()}).`);
        return;
      }
      playTone(true, muted);
      setLastScan({
        profile: result.profile,
        scan_type: result.scan_type,
        status: result.status,
        course: result.course,
      });
      qc.invalidateQueries({ queryKey: ["attendance-all"] });
    } catch {
      playTone(false, muted);
      toast.error("Scan failed — try again.");
    } finally {
      setBusy(false);
      setUid("");
    }
  };

  useRfidScanner(
    (code) => void handleTapPayload({ uid: code, timestamp: new Date().toISOString() }),
    !!profile,
  );

  if (!profile) return null;

  const today = new Date().toDateString();
  const todayLogs = (logs ?? []).filter((l) => new Date(l.timestamp).toDateString() === today);
  const nameOf = new Map((students ?? []).map((s) => [s.id, s]));

  const feedCounts: Record<FeedFilter, number> = {
    all: todayLogs.length,
    in: todayLogs.filter((l) => l.scan_type === "in").length,
    out: todayLogs.filter((l) => l.scan_type === "out").length,
    late: todayLogs.filter((l) => l.scan_type === "in" && l.status === "late").length,
  };
  const visibleLogs = todayLogs.filter((l) => {
    if (filter === "in") return l.scan_type === "in";
    if (filter === "out") return l.scan_type === "out";
    if (filter === "late") return l.scan_type === "in" && l.status === "late";
    return true;
  });

  const markStatus = async (id: string, status: AttendanceStatus) => {
    try {
      await updateAttendanceLog(id, { status });
      toast.success(`Marked as ${status}.`);
      qc.invalidateQueries({ queryKey: ["attendance-all"] });
    } catch {
      toast.error("Update failed.");
    }
  };

  const removeLog = async (id: string) => {
    if (!confirm("Delete this attendance record?")) return;
    try {
      await deleteAttendanceLog(id);
      toast.success("Record deleted.");
      qc.invalidateQueries({ queryKey: ["attendance-all"] });
    } catch {
      toast.error("Delete failed.");
    }
  };

  return (
    <AppShell nav={TEACHER_NAV} profile={profile} subtitle="Teacher Portal">
      {/* Big scan-result banner */}
      <AnimatePresence>
        {lastScan && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border p-4 shadow-lift backdrop-blur-xl",
              lastScan.scan_type === "out"
                ? "border-sky-300/60 bg-sky-50/95 dark:border-sky-500/40 dark:bg-sky-950/90"
                : lastScan.status === "late"
                  ? "border-amber-300/60 bg-amber-50/95 dark:border-amber-500/40 dark:bg-amber-950/90"
                  : "border-emerald-300/60 bg-emerald-50/95 dark:border-emerald-500/40 dark:bg-emerald-950/90",
            )}
          >
            <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
              <MiowMark plate={false} className="h-4 w-4" />
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {KIOSK_EVENT_HEADER}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <img
                src={lastScan.profile.avatar_url ?? ""}
                alt={lastScan.profile.full_name}
                className="h-12 w-12 rounded-full ring-2 ring-white/60"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{lastScan.profile.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {lastScan.profile.student_id} · {lastScan.profile.section}
                </p>
                {lastScan.course && (
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {lastScan.course.code} {lastScan.course.start_time.slice(0, 5)}–
                    {lastScan.course.end_time.slice(0, 5)} · grace{" "}
                    {lastScan.course.late_threshold_minutes}m
                  </p>
                )}
              </div>
              <p
                className={cn(
                  "font-display text-lg font-extrabold",
                  lastScan.scan_type === "out"
                    ? "text-sky-600 dark:text-sky-300"
                    : lastScan.status === "late"
                      ? "text-amber-600 dark:text-amber-300"
                      : "text-emerald-600 dark:text-emerald-300",
                )}
              >
                {lastScan.scan_type === "in"
                  ? lastScan.status === "late"
                    ? "LATE"
                    : "ON TIME"
                  : "OUT"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{KIOSK_TITLE}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Students tap their RFID ID at the gate. On-time vs late is evaluated against today's
            class schedule (each course's grace period); with no scheduled class, the 7:30 AM gate
            cutoff applies. Absent = no tap within the session window.
          </p>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          title={muted ? "Unmute scan sounds" : "Mute scan sounds"}
          className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {muted ? "Muted" : "Sound on"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-slate-900 p-8 text-center text-slate-400">
            <Nfc className="h-10 w-10" />
            <p className="text-sm font-semibold">RFID Kiosk</p>
            <p className="text-xs">Tap a card or enter a UID below</p>
          </Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (uid.trim()) {
                void handleTapPayload({ uid, timestamp: new Date().toISOString() });
              }
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Nfc className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                aria-label="RFID UID"
                placeholder="RFID UID — or just tap a card"
                className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Tap
            </button>
            <button
              type="button"
              disabled={busy}
              title="Dispatch a simulated reader payload"
              onClick={() =>
                void handleTapPayload(createMockTapPayload(uid.trim() || undefined), true)
              }
              className="flex h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Simulate
            </button>
          </form>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Today's feed</h2>
            <FilterTabs<FeedFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: "All" },
                { value: "in", label: "In" },
                { value: "out", label: "Out" },
                { value: "late", label: "Late" },
              ]}
              counts={feedCounts}
            />
          </div>
          <Card className="max-h-[560px] divide-y divide-border overflow-y-auto">
            {visibleLogs.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {todayLogs.length === 0 ? "No taps yet today." : "No records match this filter."}
              </p>
            )}
            {visibleLogs.map((l) => {
              const s = nameOf.get(l.student_id);
              const t = attendanceTone(l.status);
              return (
                <div key={l.id} className="flex items-center gap-3 p-3.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      l.scan_type === "in"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
                    )}
                  >
                    {l.scan_type === "in" ? (
                      <LogIn className="h-4 w-4" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s?.full_name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{fmtTime(l.timestamp)}</p>
                  </div>
                  {l.scan_type === "in" ? (
                    <select
                      value={l.status}
                      onChange={(e) => markStatus(l.id, e.target.value as AttendanceStatus)}
                      title="Manual override"
                      className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="on-time">On time</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  ) : (
                    <Badge tone={t.tone}>{t.label}</Badge>
                  )}
                  <button
                    onClick={() => removeLog(l.id)}
                    title="Delete record"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
