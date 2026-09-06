import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AVATAR_MAX_BYTES } from "@/components/courses/constants";
import {
  Bell,
  Contrast,
  KeyRound,
  Monitor,
  Moon,
  Nfc,
  Palette,
  Save,
  ShieldCheck,
  Sun,
  Type,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppShell,
  Badge,
  Card,
  Field,
  STUDENT_NAV,
  Toggle,
  useProfile,
  useRfidScanner,
} from "@/components/lms";
import {
  findProfileByCredential,
  updateProfile,
  updateSessionProfile,
  uploadAvatar,
} from "@/lib/lms";
import {
  applyFontSize,
  applyHighContrast,
  applyThemeMode,
  getFontSize,
  getHighContrast,
  getThemeMode,
  getUserSettings,
  logAudit,
  saveUserSettings,
  type FontSize,
  type ThemeMode,
  type UserSettings,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/student/settings")({
  head: () => ({
    meta: [
      { title: "Student Settings | MIOW - Integrated Developmental School" },
      {
        name: "description",
        content: "Manage your profile, RFID card, notifications, and accessibility preferences.",
      },
      {
        property: "og:title",
        content: "Student Settings | MIOW - Integrated Developmental School",
      },
      {
        property: "og:description",
        content: "Manage your profile, hardware, notifications, and accessibility preferences.",
      },
    ],
  }),
  component: StudentSettings,
});

type Tab = "profile" | "hardware" | "notifications" | "preferences";

const TABS: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "profile", label: "Profile & Identity", icon: <UserRound className="h-4 w-4" /> },
  { value: "hardware", label: "Hardware & Security", icon: <ShieldCheck className="h-4 w-4" /> },
  { value: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { value: "preferences", label: "Preferences", icon: <Palette className="h-4 w-4" /> },
];

function StudentSettings() {
  const profile = useProfile(["student"]);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("profile");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  // Last-saved snapshot — drives the dirty flag that enables the Save button.
  const [savedProfile, setSavedProfile] = useState<{
    name: string;
    email: string;
    phone: string;
    address: string;
  } | null>(null);

  // Hardware state
  const [listening, setListening] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Preference state
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const [contrast, setContrast] = useState(false);

  useEffect(() => {
    if (profile && !loaded) {
      const s = getUserSettings(profile.id);
      setSettings(s);
      setName(profile.full_name);
      setEmail(profile.email ?? "");
      setSavedProfile({
        name: profile.full_name,
        email: profile.email ?? "",
        phone: s.phone,
        address: s.address,
      });
      setTheme(getThemeMode());
      setFontSize(getFontSize());
      setContrast(getHighContrast());
      setLoaded(true);
    }
  }, [profile, loaded]);

  const rebindRfid = useCallback(
    async (uid: string) => {
      if (!profile) return;
      try {
        await updateProfile(profile.id, { rfid_uid: uid });
        logAudit("RFID re-binding", `Card ••••${uid.slice(-4)} linked to ${profile.full_name}`);
        toast.success(`RFID card ••••${uid.slice(-4)} linked to your account`);
      } catch {
        toast.error("Could not save the new card. Try again.");
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

  const persist = (next: UserSettings, message = "Changes saved successfully") => {
    setSettings(next);
    saveUserSettings(profile.id, next);
    toast.success(message);
  };

  const profileDirty =
    !!savedProfile &&
    (name !== savedProfile.name ||
      email !== savedProfile.email ||
      settings.phone !== savedProfile.phone ||
      settings.address !== savedProfile.address);

  const saveProfile = async () => {
    if (!name.trim()) {
      toast.error("Full name is required");
      return;
    }
    setSavingProfile(true);
    try {
      // Payload keys match the backend schema (snake_case profile columns).
      await updateProfile(profile.id, { full_name: name.trim(), email: email.trim() || null });
      persist({ ...settings });
      // Refresh the global profile store: writes the merged session to
      // localStorage AND notifies every subscriber (sidebar, navbar, chat
      // widget) so the new name/avatar renders without a page refresh.
      updateSessionProfile({
        full_name: name.trim(),
        email: email.trim() || null,
        avatar_url: settings.avatar ?? profile.avatar_url,
      });
      // The kiosk demo quick sign-in list caches names/avatars — refresh it.
      queryClient.invalidateQueries({ queryKey: ["demo-profiles"] });
      setSavedProfile({
        name: name.trim(),
        email: email.trim(),
        phone: settings.phone,
        address: settings.address,
      });
      logAudit("Profile updated", `${profile.full_name} edited profile & identity fields`);
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
    if (f.size > AVATAR_MAX_BYTES) {
      toast.error("Please choose an image under 2 MB");
      return;
    }
    setAvatarBusy(true);
    try {
      // Server pipeline: the file is written to private storage and
      // profiles.avatar_url is updated in the same call. The response record
      // carries the new versioned path, and uploadAvatar() refreshes the
      // global session store so the sidebar/navbar/chat avatar re-renders
      // without a browser refresh.
      await uploadAvatar(f);
      persist({ ...settings, avatar: null }, "Avatar updated");
      // Drop the cached demo quick sign-in list so the kiosk shows the new photo.
      queryClient.invalidateQueries({ queryKey: ["demo-profiles"] });
      logAudit("Avatar updated", `${profile.full_name} uploaded a new profile photo`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed — please try again");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const changePin = async () => {
    if (!/^\d{4,8}$/.test(newPin)) {
      toast.error("New PIN must be 4–8 digits");
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
      await updateProfile(profile.id, { pin: newPin });
      // Rotate the session token to the freshly issued one.
      updateSessionProfile({
        session_token: verified.session_token ?? profile.session_token ?? "",
      });
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      logAudit("PIN changed", `${profile.full_name} reset their account PIN`);
      toast.success("PIN updated successfully");
    } catch {
      toast.error("Could not update PIN");
    } finally {
      setPinBusy(false);
    }
  };

  const avatarSrc = settings.avatar ?? profile.avatar_url ?? "";

  return (
    <AppShell nav={STUDENT_NAV} profile={profile} subtitle="Student Portal">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your identity, hardware, notifications, and accessibility preferences.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Tab navigation */}
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
                Your name and email are saved to the school records system.
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
                    aria-label="Upload avatar image"
                    onChange={(e) => onAvatarFile(e.target.files?.[0])}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarBusy}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5" /> {avatarBusy ? "Uploading…" : "Upload photo"}
                  </button>
                  {avatarSrc && (
                    <button
                      onClick={() => {
                        persist({ ...settings, avatar: null }, "Avatar removed");
                        // Clear the stored photo too, and sync every surface.
                        updateSessionProfile({ avatar_url: null });
                        void updateProfile(profile.id, { avatar_url: null })
                          .then(() =>
                            queryClient.invalidateQueries({ queryKey: ["demo-profiles"] }),
                          )
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
                  <Field
                    label="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                  />
                  <Field
                    label="Student ID"
                    value={profile.student_id ?? "—"}
                    disabled
                    aria-readonly
                  />
                  <Field
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={320}
                    placeholder="you@student.northview.edu"
                  />
                  <Field
                    label="Contact phone"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    maxLength={20}
                    placeholder="+63 9xx xxx xxxx"
                  />
                  <div className="sm:col-span-2">
                    <Field
                      label="Home address"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      maxLength={300}
                      placeholder="Barangay, City, Province"
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingProfile || !profileDirty}
                    title={profileDirty ? "Save profile changes" : "No changes to save"}
                    className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lift transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" /> {savingProfile ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* ---------- Hardware & Security ---------- */}
          {tab === "hardware" && (
            <>
              <Card className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">RFID Card</h2>
                    <p className="text-xs text-muted-foreground">
                      Tap a new card on the kiosk reader to re-link it to your account.
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
                    {listening ? "Cancel scan" : "Scan new card"}
                  </button>
                  <button
                    onClick={() => {
                      // Dispatch a mock reader payload ({ uid, timestamp }) through the
                      // same rebind path a real keyboard-emulating reader would hit.
                      const uid = String(Math.floor(1e9 + Math.random() * 9e9));
                      toast.info(`Mock tap received — card ••••${uid.slice(-4)}`, {
                        description: `Reader payload dispatched at ${new Date().toLocaleTimeString("en-PH")}`,
                      });
                      void rebindRfid(uid);
                    }}
                    className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    Simulate tap
                  </button>
                </div>
                {listening && (
                  <p className="mt-3 animate-pulse text-xs text-muted-foreground">
                    Waiting for card… type the digits on any keyboard-emulating reader and press
                    Enter.
                  </p>
                )}
              </Card>

              <Card className="p-6">
                <h2 className="font-display text-lg font-bold">Reset Account PIN</h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Your current PIN is verified first; the new PIN is stored as a bcrypt hash and
                  your session token is rotated.
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
                      maxLength={8}
                    />
                    <Field
                      label="New PIN"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      maxLength={8}
                    />
                    <Field
                      label="Confirm new PIN"
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      maxLength={8}
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
            </>
          )}

          {/* ---------- Notifications ---------- */}
          {tab === "notifications" && (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">Notifications</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                Choose which alerts you receive and where.
              </p>
              <div className="space-y-2">
                <Toggle
                  label="Deadline reminder — 24 hours"
                  description="Get alerted a day before an assignment is due"
                  checked={settings.notif.deadline24h}
                  onChange={(v) =>
                    persist({ ...settings, notif: { ...settings.notif, deadline24h: v } })
                  }
                />
                <Toggle
                  label="Deadline reminder — 1 hour"
                  description="Last-call alert before submission closes"
                  checked={settings.notif.deadline1h}
                  onChange={(v) =>
                    persist({ ...settings, notif: { ...settings.notif, deadline1h: v } })
                  }
                />
                <Toggle
                  label="Grade released"
                  description="Notify me when a teacher publishes a new grade"
                  checked={settings.notif.gradeReleased}
                  onChange={(v) =>
                    persist({ ...settings, notif: { ...settings.notif, gradeReleased: v } })
                  }
                />
                <Toggle
                  label="Attendance confirmations"
                  description="Confirm each gate tap-in / tap-out"
                  checked={settings.notif.attendanceConfirm}
                  onChange={(v) =>
                    persist({ ...settings, notif: { ...settings.notif, attendanceConfirm: v } })
                  }
                />
                <Toggle
                  label="Urgent announcements"
                  description="School-wide emergency broadcasts"
                  checked={settings.notif.urgentBroadcast}
                  onChange={(v) =>
                    persist({ ...settings, notif: { ...settings.notif, urgentBroadcast: v } })
                  }
                />
              </div>

              <h3 className="mb-2 mt-6 text-sm font-bold">Channels</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["email", "Email"],
                    ["inApp", "In-App"],
                    ["push", "Push"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      persist({
                        ...settings,
                        channels: { ...settings.channels, [key]: !settings.channels[key] },
                      })
                    }
                    aria-pressed={settings.channels[key]}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                      settings.channels[key]
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* ---------- Preferences & Accessibility ---------- */}
          {tab === "preferences" && (
            <Card className="p-6">
              <h2 className="font-display text-lg font-bold">Preferences & Accessibility</h2>
              <p className="mb-5 text-xs text-muted-foreground">
                Applied immediately and remembered on this device.
              </p>

              <h3 className="mb-2 text-sm font-bold">Theme</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["light", "Light", <Sun key="s" className="h-4 w-4" />],
                    ["dark", "Dark", <Moon key="m" className="h-4 w-4" />],
                    ["system", "System", <Monitor key="y" className="h-4 w-4" />],
                  ] as const
                ).map(([mode, label, icon]) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setTheme(mode);
                      applyThemeMode(mode);
                      toast.success(`Theme set to ${label}`);
                    }}
                    aria-pressed={theme === mode}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                      theme === mode
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-bold">
                <Type className="h-4 w-4" /> Font size
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setFontSize(size);
                      applyFontSize(size);
                      toast.success(`Font size: ${size}`);
                    }}
                    aria-pressed={fontSize === size}
                    className={cn(
                      "rounded-xl border px-4 py-3 font-semibold capitalize transition-colors",
                      size === "small" && "text-xs",
                      size === "medium" && "text-sm",
                      size === "large" && "text-base",
                      fontSize === size
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card/60 text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-bold">
                <Contrast className="h-4 w-4" /> Accessibility
              </h3>
              <Toggle
                label="High-contrast mode"
                description="Stronger borders and text contrast for readability"
                checked={contrast}
                onChange={(v) => {
                  setContrast(v);
                  applyHighContrast(v);
                  toast.success(v ? "High contrast enabled" : "High contrast disabled");
                }}
              />
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
