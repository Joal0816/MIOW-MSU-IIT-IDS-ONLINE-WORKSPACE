import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CloudUpload,
  FileText,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAnnouncement,
  deleteAnnouncement,
  fmtDate,
  formatFileSize,
  listAnnouncements,
  updateAnnouncement,
  type Announcement,
} from "@/lib/lms";
import { notifyAnnouncement } from "@/lib/notifications";
import {
  staffNav,
  AppShell,
  Badge,
  EmptyState,
  FilterTabs,
  Modal,
  MotionCard,
  useProfile,
} from "@/components/lms";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/admin/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content: "Post school-wide announcements, events and urgent advisories.",
      },
      { property: "og:title", content: "Announcements | MIOW - MSU-IIT IDS Online Workspace" },
      {
        property: "og:description",
        content: "Post school-wide announcements, events and urgent advisories.",
      },
    ],
  }),
  component: AnnouncementsPage,
});

interface FormState {
  title: string;
  content: string;
  category: "urgent" | "event" | "academic";
  target_audience: string;
  pinned: boolean;
}

const EMPTY_FORM: FormState = {
  title: "",
  content: "",
  category: "academic",
  target_audience: "all",
  pinned: false,
};

type AudienceFilter = "all" | "students" | "teachers";

function AnnouncementsPage() {
  const profile = useProfile(["admin", "teacher"]);
  const qc = useQueryClient();
  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: listAnnouncements,
    enabled: !!profile,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [dragging, setDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const ACCEPTED = ".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip";
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  const addFiles = (incoming: FileList | File[]) => {
    const next = [...pendingFiles];
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is over 25 MB.`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.reduce((s, f) => s + f.size, 0) + file.size > 60 * 1024 * 1024) {
        toast.error("Batch is too large (max 60 MB total).");
        break;
      }
      next.push(file);
    }
    setPendingFiles(next);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  if (!profile) return null;

  const sorted = [...(announcements ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const visible = sorted.filter((a) => {
    if (audience === "all") return true;
    if (audience === "students")
      return a.target_audience === "students" || a.target_audience === "all";
    return a.target_audience === "teachers" || a.target_audience === "all";
  });
  const counts: Record<AudienceFilter, number> = {
    all: sorted.length,
    students: sorted.filter((a) => a.target_audience === "students" || a.target_audience === "all")
      .length,
    teachers: sorted.filter((a) => a.target_audience === "teachers" || a.target_audience === "all")
      .length,
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      category: a.category,
      target_audience: a.target_audience,
      pinned: a.pinned,
    });
    setPendingFiles([]);
    setDragging(false);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.content) {
      toast.error("Title and content are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, form);
        void notifyAnnouncement({
          title: form.title,
          content: form.content,
          target_audience: form.target_audience,
        }).catch(() => {});
        if (pendingFiles.length)
          toast.success(
            `Announcement updated — ${pendingFiles.length} file(s) queued for upload (UI only).`,
          );
        else toast.success("Announcement updated.");
      } else {
        await createAnnouncement({ ...form, author_id: profile.id });
        void notifyAnnouncement({
          title: form.title,
          content: form.content,
          target_audience: form.target_audience,
        }).catch(() => {});
        if (pendingFiles.length)
          toast.success(
            `Announcement posted — ${pendingFiles.length} file(s) queued for upload (UI only).`,
          );
        else toast.success("Announcement posted.");
      }
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setPendingFiles([]);
      setDragging(false);
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch {
      toast.error(editing ? "Could not update announcement." : "Could not post announcement.");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (a: Announcement) => {
    try {
      await updateAnnouncement(a.id, { pinned: !a.pinned });
      toast.success(a.pinned ? "Unpinned." : "Pinned to the top.");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch {
      toast.error("Could not update pin.");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      toast.success("Announcement deleted.");
      qc.invalidateQueries({ queryKey: ["announcements"] });
    } catch {
      toast.error("Delete failed.");
    }
  };

  return (
    <AppShell
      nav={staffNav(profile.role)}
      profile={profile}
      subtitle={profile.role === "admin" ? "MIOW Admin Console" : "MIOW Teacher Portal"}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Announcements</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Broadcast to students, teachers, or everyone.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setPendingFiles([]);
            setDragging(false);
            setOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New announcement
        </button>
      </div>

      <div className="mb-5">
        <FilterTabs<AudienceFilter>
          value={audience}
          onChange={setAudience}
          options={[
            { value: "all", label: "All" },
            { value: "students", label: "Students" },
            { value: "teachers", label: "Teachers" },
          ]}
          counts={counts}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={sorted.length ? "Nothing for this audience" : "No announcements yet"}
          {...(sorted.length ? { sub: "Try a different audience filter." } : {})}
        />
      ) : (
        <div className="space-y-3">
          {visible.map((a, i) => (
            <MotionCard
              key={a.id}
              delay={Math.min(i * 0.04, 0.3)}
              className={cn("p-5", a.pinned && "border-primary/40 bg-primary/5")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.pinned && (
                      <Badge tone="amber">
                        <Pin className="h-3 w-3" /> Pinned
                      </Badge>
                    )}
                    <Badge
                      tone={
                        a.category === "urgent"
                          ? "red"
                          : a.category === "event"
                            ? "green"
                            : "indigo"
                      }
                    >
                      {a.category}
                    </Badge>
                    <Badge tone="slate">{a.target_audience}</Badge>
                    <p className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</p>
                  </div>
                  <p className="mt-2 font-semibold">{a.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.content}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => togglePin(a)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10"
                    title={a.pinned ? "Unpin" : "Pin to top"}
                  >
                    {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(a.id)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
          setPendingFiles([]);
          setDragging(false);
        }}
        title={editing ? "Edit announcement" : "New announcement"}
      >
        <div className="grid gap-3">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Title *"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Announcement body *"
            rows={4}
            className="rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value as FormState["category"] }))
              }
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="academic">Academic</option>
              <option value="event">Event</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={form.target_audience}
              onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
              className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Everyone</option>
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
            </select>
          </div>

          {/* Drag-drop attachments (UI — pending files, upload via course-material pattern when wired) */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Attach files to announcement"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-5 text-center transition",
              dragging
                ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                : "border-border hover:border-primary/50 hover:bg-muted/60",
            )}
          >
            <CloudUpload
              className={cn("h-6 w-6", dragging ? "text-primary" : "text-muted-foreground")}
            />
            <p className="text-sm font-semibold">
              {dragging ? "Drop files here" : "Drag and drop files here, or browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, DOCX, PNG, JPG, ZIP (Max: 25 MB each, 60 MB total)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED}
              className="hidden"
              aria-label="Announcement attachments"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {pendingFiles.length > 0 && (
            <ul className="grid gap-1.5">
              {pendingFiles.map((f) => (
                <li
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{f.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((x) => x !== f))}
                    aria-label={`Remove ${f.name}`}
                    className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pendingFiles.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" /> {pendingFiles.length} file(s) pending — will be
              attached when announcement is posted
            </p>
          )}
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Pin className="h-3.5 w-3.5" /> Pin to the top of every feed
            </span>
          </label>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : editing ? "Save changes" : "Post announcement"}
        </button>
      </Modal>
    </AppShell>
  );
}
