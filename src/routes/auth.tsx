import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  KeyRound,
  Nfc,
  ScanFace,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { dbg, dbgError } from "@/lib/debug";
import {
  dashboardPathFor,
  findProfileByRfid,
  listAnnouncements,
  loadSession,
  pinLogin,
  saveSession,
  type Profile,
} from "@/lib/lms";
import { Badge, CameraPanel, useRfidScanner } from "@/components/lms";
import { cn } from "@/lib/utils";
import { MiowLockup } from "@/components/brand";
import { APP_TAGLINE } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content:
          "Secure sign-in kiosk for MSU-IIT IDS Online Workspace (MIOW). Tap your RFID ID card, verify with face recognition, or use your student number and PIN.",
      },
      { property: "og:title", content: "Sign In | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "RFID + face-recognition sign-in kiosk for MSU-IIT IDS Online Workspace (MIOW).",
      },
      { property: "og:image", content: "/og-cover.jpg" },
      { name: "twitter:image", content: "/og-cover.jpg" },
    ],
  }),
  component: AuthPage,
});

const VERIFY_STEPS = ["Locating face…", "Matching biometrics…", "Liveness check…", "Identity confirmed"];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"scan" | "pin">("scan");
  const [verifying, setVerifying] = useState<Profile | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [uid, setUid] = useState("");
  const [login, setLogin] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Non-critical kiosk chrome: a transient backend blip must never take the
  // sign-in page down, so this query degrades to an empty list instead of
  // surfacing as a page-level error. Sign-in itself still reports failures.
  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: () => listAnnouncements().catch(() => []),
  });

  useEffect(() => {
    const existing = loadSession();
    if (existing) navigate({ to: dashboardPathFor(existing.role), replace: true });
    return () => timers.current.forEach(clearTimeout);
  }, [navigate]);

  const startVerify = (p: Profile) => {
    setVerifying(p);
    setStep(0);
    setDone(false);
    VERIFY_STEPS.forEach((_, i) => {
      timers.current.push(setTimeout(() => setStep(i), i * 700));
    });
    timers.current.push(
      setTimeout(() => {
        setDone(true);
        saveSession(p);
        toast.success(`Welcome, ${p.full_name.split(" ")[0]}!`);
        timers.current.push(
          setTimeout(() => navigate({ to: dashboardPathFor(p.role) }), 900),
        );
      }, VERIFY_STEPS.length * 700),
    );
  };

  const handleUid = async (code: string) => {
    if (verifying || busy) return;
    dbg("auth", "RFID tap", { uid: code.trim() });
    setBusy(true);
    try {
      const p = await findProfileByRfid(code.trim());
      if (p) startVerify(p);
      else toast.error("Card not recognized. Please register your RFID with the registrar.");
    } catch {
      toast.error("Scanner error — please try again.");
    } finally {
      setBusy(false);
    }
  };

  useRfidScanner(handleUid, !verifying && mode === "scan");

  const handlePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    dbg("auth", "PIN login clicked", { login: login.trim(), pinLength: pin.trim().length });
    setBusy(true);
    try {
      const res = await pinLogin(login.trim(), pin.trim());
      dbg("auth", "pinLogin result", { ok: res.ok, reason: (res as any).reason, profile: (res as any).profile?.role });
      if (res.ok) {
        startVerify(res.profile);
      } else if (res.reason === "locked") {
        toast.error(
          `Account locked after too many failed attempts — try again in ~${res.retryAfterMinutes ?? 15} min.`,
        );
      } else {
        toast.error(
          `Invalid credentials${
            typeof res.attemptsLeft === "number"
              ? ` — ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left before lockout`
              : ""
          }.`,
        );
      }
    } catch (e) {
      dbgError("auth", "PIN login error", e);
      toast.error("Sign-in failed — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const marqueeText = (announcements ?? []).map((a) => a.title).join("  •  ");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <MiowLockup size="md" tone="sidebar" subLabel={APP_TAGLINE} className="max-w-sm" />
        </div>
        <div className="relative space-y-6">
          <p className="font-display text-4xl font-bold leading-tight text-sidebar-foreground">
            One tap.
            <br />
            One glance.
            <br />
            <span className="text-sidebar-primary">You're in class.</span>
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-sidebar-foreground/70">
            RFID attendance, face-verified sign-in, DepEd-computed grades, worksheets and
            announcements — the whole campus in one learning platform.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="indigo">RFID Attendance</Badge>
            <Badge tone="green">Face Verification</Badge>
            <Badge tone="sky">DepEd Transmutation</Badge>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-sidebar-border bg-sidebar-accent/60 py-2.5">
          <div className="animate-marquee whitespace-nowrap text-xs font-medium text-sidebar-foreground/70">
            <span className="px-4">{marqueeText || "Welcome to MIOW — SY 2026–2027 enrollment now open"}</span>
          </div>
        </div>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <MiowLockup size="sm" />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-8">
            {!verifying ? (
              <>
                <h1 className="sr-only">Sign in to MSU-IIT IDS Online Workspace (MIOW)</h1>
                <MiowLockup size="lg" aria-hidden />
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your ID/username and PIN to continue.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  {(
                    [
                      ["scan", "RFID Card", Nfc],
                      ["pin", "PIN Login", KeyRound],
                    ] as const
                  ).map(([m, label, Icon]) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                        mode === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>

                {mode === "scan" ? (
                  <div className="mt-6 space-y-4">
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
                      <div className="animate-pulse-ring flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        <Nfc className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm font-semibold">Listening for card tap…</p>
                      <p className="text-xs text-muted-foreground">
                        Hold your ID near the reader, or enter the UID below to simulate a tap.
                      </p>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (uid.trim()) handleUid(uid);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        id="rfid-uid"
                        value={uid}
                        onChange={(e) => setUid(e.target.value)}
                        placeholder="RFID UID (e.g. 0412345678)"
                        aria-label="RFID UID"
                        className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Tap
                      </button>
                    </form>
                  </div>
                ) : (
                  <form onSubmit={handlePin} className="mt-6 space-y-3">
                    <p className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      One login for students, teachers, and admins. Accounts lock for 15 minutes
                      after 5 failed attempts.
                    </p>
                    <input
                      id="login-id"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="Student ID, email, or username"
                      aria-label="Student ID, email, or username"
                      autoComplete="username"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                      id="login-pin"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="PIN or password"
                      type="password"
                      aria-label="PIN or password"
                      autoComplete="current-password"
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="submit"
                      disabled={busy || !login.trim() || !pin}
                      className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      Continue to face verification
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center py-2 text-center">
                <CameraPanel scanning={!done} className="aspect-[4/3] w-full" />
                <div className="mt-5 flex items-center gap-2">
                  {done ? (
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <ScanFace className="h-5 w-5 animate-pulse text-primary" />
                  )}
                  <p className={cn("text-sm font-semibold", done && "text-emerald-600")}>
                    {done ? `Verified — welcome, ${verifying.full_name.split(" ")[0]}!` : VERIFY_STEPS[step]}
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {verifying.full_name} · {verifying.role}
                  {verifying.section ? ` · ${verifying.section}` : ""}
                </p>
                <div className="mt-4 flex gap-1.5">
                  {VERIFY_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 w-8 rounded-full transition-colors",
                        i <= step ? "bg-primary" : "bg-muted",
                        done && "bg-emerald-500",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Protected by RFID + biometric verification · MSU-IIT Integrated Development School
          </p>
        </div>
      </div>
    </div>
  );
}
