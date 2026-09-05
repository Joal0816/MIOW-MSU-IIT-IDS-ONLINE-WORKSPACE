import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { toast } from "sonner";
import {
  Bell,
  GraduationCap,
  KeyRound,
  Nfc,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, Badge, Card, TEACHER_NAV, useProfile, useRfidScanner } from "@/components/lms";
import {
  findProfileByCredential,
  updateSessionProfile,
  updateTeacherSettings,
  uploadAvatar,
} from "@/lib/lms";
import {
  getTeacherSettings,
  logAudit,
  saveTeacherSettings,
  type TeacherSettings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/teacher/settings")({
  head: () => ({
    meta: [
      { title: "Teacher Settings | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content:
          "Faculty settings: profile and identity, keycard and face enrollment, and teaching defaults for attendance and worksheet retakes.",
      },
      { property: "og:title", content: "Teacher Settings | MIOW - Integrated Developmental School" },
      {
        property: "og:description",
        content: "Manage your faculty profile, kiosk credentials, and classroom defaults.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherSettingsPage,
});

type Tab = "profile" | "security" | "teaching";

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "profile", label: "Profile & Identity", icon: <UserRound className="h-4 w-4" /> },
  { value: "security", label: "Security & Credentials", icon: <ShieldCheck className="h-4 w-4" /> },
  {
    value: "teaching",
    label: "Teaching Preferences",
    icon: <SlidersHorizontal className="h-4 w-4" />,
  },
];

const PREFIXES = ["", "Dr.", "Prof.", "Mr.", "Ms.", "Mrs.", "Engr."];

function Field({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none backdrop-blur-sm transition-shadow focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-muted/50"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function TeacherSettingsPage() {
  const profile = useProfile(["teacher"]);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const [settings, setSettings] = useState<TeacherSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Profile tab
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [savedProfile, setSavedProfile] = useState<{
    name: string;
    email: string;
    prefix: string;
    department: string;
    bio: string;
    officeHours: string;
  } | null>(null);

  // Security tab
  const [listening, setListening] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  useEffect(() => {
    if (profile && !loaded) {
      const s = getTeacherSettings(profile.id);
      setSettings(s);
      setName(profile.full_name);
      setEmail(profile.email ?? "");
      setSavedProfile({
        name: profile.full_name,
        email: profile.email ?? "",
        prefix: s.prefix,
        department: s.department,
        bio: s.bio,
        officeHours: s.officeHours,
      });
      setLoaded(true);
    }
  }, [profile, loaded]);

  const rebindRfid = useCallback(
    async (uid: string) => {
      if (!profile) return;
      try {
        await updateTeacherSettings({ rfid_uid: uid });
        logAudit("Keycard re-binding", `Card ••••${uid.slice(-4)} linked to ${profile.full_name}`);
        toast.success(`Keycard ••••${uid.slice(-4)} linked to your faculty account`);
      } catch {
        toast.error("Could not save the new keycard. Try again.");
      }
    },
    [profile],
  );

  useRfidScanner(
    useCallback(
      (uid: string) => {
        setListening(false);
        void rebindRfid(uid);
      },
      [rebindRfid],
    ),
    listening,
  );

  if (!profile || !settings) return null;

  const persist = (next: TeacherSettings, message = "Changes saved successfully") => {
    setSettings(next);
    saveTeacherSettings(profile.id, next);
    toast.success(message);
  };

  const profileDirty =
    !!savedProfile &&
    (name !== savedProfile.name ||
      email !== savedProfile.email ||
      settings.prefix !== savedProfile.prefix ||
      settings.department !== savedProfile.department ||
      settings.bio !== savedProfile.bio ||
      settings.officeHours !== savedProfile.officeHours);

  const displayName = () => {
    const trimmed = name.trim();
    const prefix = settings.prefix.trim();
    if (!prefix || trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return trimmed;
    return `${prefix} ${trimmed}`;
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSavingProfile(true);
    try {
      // Teacher-only endpoint: the server resolves the faculty row from the
      // session token, saves the record, then we refresh the global session
      // store so the sidebar pill + header pill re-render instantly.
      const full_name = displayName();
      await updateTeacherSettings({ full_name, email: email.trim() || null });
      setName(full_name);
      persist({ ...settings });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setSavedProfile({
        name: full_name,
        email: email.trim(),
        prefix: settings.prefix,
        department: settings.department,
        bio: settings.bio,
        officeHours: settings.officeHours,
      });
      logAudit("Faculty profile updated", `${full_name} edited their profile & identity fields`);
    } catch {
      toast.error("Could not save changes");
    } finally {
      setSavingProfile(false);
    }
  };

  const onAvatarFile = async (f: File | undefined) => {
    if (!f || avatarBusy) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
      toast.error("Please choose a PNG, JPEG, WebP, or GIF image");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Please choose an image under 2 MB");
      return;
    }
    // Immediate local preview while the upload runs.
    setAvatarPreview(URL.createObjectURL(f));
    setAvatarBusy(true);
    try {
      // Stored under a versioned filename, so the new photo never serves
      // from cache; uploadAvatar() also refreshes the global session store.
      await uploadAvatar(f);
      setAvatarPreview(null);
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      toast.success("Avatar updated");
      logAudit("Avatar updated", `${profile.full_name} uploaded a new faculty photo`);
    } catch (err) {
      setAvatarPreview(null);
      toast.error(err instanceof Error ? err.message : "Upload failed — please try again");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const changePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error("New PIN must be 4–6 digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match");
      return;
    }
    setPinBusy(true);
    try {
      const login = profile.email ?? profile.student_id ?? "";
      const verified = await findProfileByCredential(login, oldPin);
      if (!verified) {
        toast.error("Current PIN is incorrect");
        return;
      }
      await updateTeacherSettings({ pin: newPin });
      updateSessionProfile({
        session_token: verified.session_token ?? profile.session_token ?? "",
      });
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      logAudit("PIN changed", `${profile.full_name} reset their faculty PIN`);
      toast.success("PIN updated successfully");
    } catch {
      toast.error("Could not update PIN");
    } finally {
      setPinBusy(false);
    }
  };

  const avatarSrc = avatarPreview ?? profile.avatar_url ?? "";

  return (
    <AppShell nav={TEACHER_NAV} profile={profile} subtitle="Teacher Portal">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your faculty identity, kiosk credentials, and classroom defaults.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
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
          {/* ---------- Profile & Identity ---------- */}
          {tab === "profile" && (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">Profile & Identity</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Your name, prefix, and email are saved to the faculty records system and sync
                everywhere instantly.
              </p>

              <div className="mb-6 flex items-center gap-4">
                <img
                  src={avatarSrc}
                  alt={`${profile.full_name} avatar`}
                  className="h-16 w-16 rounded-2xl object-cover ring-2 ring-primary/30"
                />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label="Upload faculty avatar image"
                    onChange={(e) => onAvatarFile(e.target.files?.[0])}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" /> {avatarBusy ? "Uploading…" : "Upload photo"}
                  </button>
                  {profile.avatar_url && (
                    <button
                      onClick={() => {
                        void updateTeacherSettings({ avatar_url: null })
                          .then(() => {
                            setAvatarPreview(null);
                            queryClient.invalidateQueries({ queryKey: ["staff"] });
                            toast.success("Avatar removed");
                          })
                          .catch(() => toast.error("Could not remove the stored photo"));
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                  <span className="self-center text-xs text-muted-foreground">
                    JPG/PNG/WebP/GIF, under 2 MB
                  </span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (profileDirty && !savingProfile) void saveProfile();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prefix
                    </span>
                    <select
                      value={settings.prefix}
                      onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
                      className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none backdrop-blur-sm focus:ring-2 focus:ring-ring"
                    >
                      {PREFIXES.map((p) => (
                        <option key={p || "none"} value={p}>
                          {p || "None"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                  <Field
                    label="Faculty / Teacher ID"
                    value={profile.student_id ?? "—"}
                    disabled
                    aria-readonly
                    title="Faculty IDs are issued by the admin office"
                  />
                  <Field
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    placeholder="you@faculty.northview.edu"
                  />
                  <Field
                    label="Department / Specialization"
                    value={settings.department}
                    onChange={(e) => setSettings({ ...settings, department: e.target.value })}
                    maxLength={120}
                    placeholder="Science — Physics & Research"
                  />
                  <Field
                    label="Office hours"
                    value={settings.officeHours}
                    onChange={(e) => setSettings({ ...settings, officeHours: e.target.value })}
                    maxLength={120}
                    placeholder="Mon–Fri, 1:00–3:00 PM · Faculty Room 2"
                  />
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Brief bio
                    </span>
                    <textarea
                      value={settings.bio}
                      onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                      maxLength={600}
                      rows={3}
                      placeholder="Shown to students on your course pages."
                      className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none backdrop-blur-sm focus:ring-2 focus:ring-ring"
                    />
                  </label>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Displayed as{" "}
                    <span className="font-semibold text-foreground">{displayName()}</span>
                  </p>
                  <button
                    type="submit"
                    disabled={savingProfile || !profileDirty}
                    title={profileDirty ? "Save profile changes" : "No changes to save"}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />{" "}
                    {savingProfile ? "Saving…" : "Save profile changes"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* ---------- Security & Credentials ---------- */}
          {tab === "security" && (
            <>
              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Change PIN</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Your current PIN is verified first; the new 4–6 digit PIN is stored as a bcrypt
                  hash and your session token is rotated.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pinBusy) void changePin();
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field
                      label="Current PIN"
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      maxLength={6}
                    />
                    <Field
                      label="New PIN"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      maxLength={6}
                    />
                    <Field
                      label="Confirm new PIN"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      maxLength={6}
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={pinBusy || !oldPin || !newPin || !confirmPin}
                      className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <KeyRound className="h-4 w-4" /> {pinBusy ? "Updating…" : "Update PIN"}
                    </button>
                  </div>
                </form>
              </Card>

              <Card className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">RFID / NFC Keycard</h2>
                    <p className="text-xs text-muted-foreground">
                      Assigned card:{" "}
                      <span className="font-semibold text-foreground">
                        {profile.has_rfid ? "•••• •••• bound" : "No card bound"}
                      </span>
                    </p>
                  </div>
                  <Badge tone={listening ? "green" : "slate"}>
                    {listening ? "Listening…" : "Idle"}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => setListening((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
                      listening
                        ? "bg-rose-600 text-white hover:bg-rose-500"
                        : "bg-primary text-primary-foreground shadow-lift hover:opacity-90",
                    )}
                  >
                    <Nfc className="h-4 w-4" />
                    {listening ? "Cancel scan" : "Register / update card"}
                  </button>
                  <button
                    onClick={() => {
                      const uid = String(Math.floor(1e9 + Math.random() * 9e9));
                      toast.info(`Mock tap received — card ••••${uid.slice(-4)}`);
                      void rebindRfid(uid);
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    Simulate tap
                  </button>
                </div>
                {listening && (
                  <p className="mt-3 animate-pulse text-xs text-muted-foreground">
                    Waiting for card… tap it on any keyboard-emulating reader.
                  </p>
                )}
              </Card>
            </>
          )}

          {/* ---------- Teaching Preferences & Defaults ---------- */}
          {tab === "teaching" && (
            <>
              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Attendance defaults</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Grace period applied to new class schedules — taps after this many minutes past
                  the start time are automatically marked late.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={1}
                    value={settings.lateThreshold}
                    aria-label="Default late threshold in minutes"
                    onChange={(e) =>
                      setSettings({ ...settings, lateThreshold: Number(e.target.value) })
                    }
                    onMouseUp={() => persist({ ...settings }, "Attendance defaults saved")}
                    onTouchEnd={() => persist({ ...settings }, "Attendance defaults saved")}
                    className="h-2 flex-1 accent-primary"
                  />
                  <span className="w-24 text-right text-sm font-semibold">
                    {settings.lateThreshold} min
                  </span>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Worksheet retake defaults</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Pre-filled when you create a new worksheet or assignment.
                </p>
                <Toggle
                  label="Allow retakes by default"
                  description="New worksheets start with retakes enabled"
                  checked={settings.allowRetakesByDefault}
                  onChange={(v) =>
                    persist({ ...settings, allowRetakesByDefault: v }, "Retake defaults saved")
                  }
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Max attempts"
                    type="number"
                    min={1}
                    max={10}
                    value={settings.defaultMaxAttempts}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultMaxAttempts: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                      })
                    }
                    onBlur={() => persist({ ...settings }, "Retake defaults saved")}
                  />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Score policy
                    </span>
                    <select
                      value={settings.defaultScorePolicy}
                      onChange={(e) =>
                        persist(
                          {
                            ...settings,
                            defaultScorePolicy: e.target
                              .value as TeacherSettings["defaultScorePolicy"],
                          },
                          "Retake defaults saved",
                        )
                      }
                      className="w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm outline-none backdrop-blur-sm focus:ring-2 focus:ring-ring"
                    >
                      <option value="highest_score">Highest score</option>
                      <option value="latest_score">Latest score</option>
                      <option value="average_score">Average score</option>
                    </select>
                  </label>
                </div>
              </Card>

              <Card className="p-6">
                <h2 className="flex items-center gap-1.5 font-display text-lg font-bold">
                  <Bell className="h-4 w-4" /> Notifications
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Alerts for classroom activity in your assigned courses.
                </p>
                <div className="space-y-2">
                  <Toggle
                    label="New submission — email"
                    description="Email me when a student submits a worksheet or assignment"
                    checked={settings.notif.submissionEmail}
                    onChange={(v) =>
                      persist({ ...settings, notif: { ...settings.notif, submissionEmail: v } })
                    }
                  />
                  <Toggle
                    label="New submission — in-app"
                    description="Show a dashboard alert for new submissions"
                    checked={settings.notif.submissionInApp}
                    onChange={(v) =>
                      persist({ ...settings, notif: { ...settings.notif, submissionInApp: v } })
                    }
                  />
                  <Toggle
                    label="Late attendance flag — email"
                    description="Email me when a student is flagged late in my class"
                    checked={settings.notif.lateAttendanceEmail}
                    onChange={(v) =>
                      persist({ ...settings, notif: { ...settings.notif, lateAttendanceEmail: v } })
                    }
                  />
                  <Toggle
                    label="Late attendance flag — in-app"
                    description="Show late taps in the attendance kiosk feed"
                    checked={settings.notif.lateAttendanceInApp}
                    onChange={(v) =>
                      persist({ ...settings, notif: { ...settings.notif, lateAttendanceInApp: v } })
                    }
                  />
                </div>
              </Card>

              <Card className="flex items-center gap-3 p-4 text-xs text-muted-foreground">
                <GraduationCap className="h-4 w-4 shrink-0" />
                Grading weights (10/20/30/40) and the academic calendar are managed by the admin
                office and apply to every faculty gradebook.
              </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
