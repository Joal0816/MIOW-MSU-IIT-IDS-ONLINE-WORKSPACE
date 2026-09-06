import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { type Assignment, COMPONENT_LABELS, updateAssignment } from "@/lib/lms";
import { Modal } from "@/components/lms";
import { MaterialManager } from "@/components/courses/material-manager";

interface EditAssignmentModalProps {
  assignment: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditAssignmentModal({ assignment, onClose, onSaved }: EditAssignmentModalProps) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editAssignForm, setEditAssignForm] = useState({
    title: "",
    description: "",
    due_date: "",
    total_points: "100",
    component_type: "written_work" as Assignment["component_type"],
  });

  const initForm = (a: Assignment) => {
    setEditAssignForm({
      title: a.title,
      description: a.description ?? "",
      due_date: a.due_date ? a.due_date.slice(0, 16) : "",
      total_points: String(a.total_points),
      component_type: a.component_type,
    });
  };

  useEffect(() => {
    if (assignment) initForm(assignment);
  }, [assignment]);

  const saveAssignEdit = async () => {
    if (!assignment) return;
    if (!editAssignForm.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await updateAssignment(assignment.id, {
        title: editAssignForm.title.trim(),
        description: editAssignForm.description || null,
        due_date: editAssignForm.due_date ? new Date(editAssignForm.due_date).toISOString() : null,
        total_points: Math.max(1, parseInt(editAssignForm.total_points) || 100),
        component_type: editAssignForm.component_type,
      });
      toast.success("Assignment updated.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!assignment}
      onClose={onClose}
      title={`Edit assignment — ${assignment?.title ?? ""}`}
    >
      <div className="grid gap-3">
        <input
          value={editAssignForm.title}
          onChange={(e) => setEditAssignForm((f) => ({ ...f, title: e.target.value }))}
          aria-label="Assignment title"
          placeholder="Title *"
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <textarea
          value={editAssignForm.description}
          onChange={(e) => setEditAssignForm((f) => ({ ...f, description: e.target.value }))}
          aria-label="Instructions"
          placeholder="Instructions"
          rows={3}
          className="rounded-xl border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            type="datetime-local"
            aria-label="Due date"
            value={editAssignForm.due_date}
            onChange={(e) => setEditAssignForm((f) => ({ ...f, due_date: e.target.value }))}
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={editAssignForm.total_points}
            onChange={(e) => setEditAssignForm((f) => ({ ...f, total_points: e.target.value }))}
            aria-label="Total points"
            placeholder="Points"
            inputMode="numeric"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={editAssignForm.component_type}
            onChange={(e) =>
              setEditAssignForm((f) => ({
                ...f,
                component_type: e.target.value as Assignment["component_type"],
              }))
            }
            aria-label="Grading component"
            className="h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(COMPONENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        {assignment && (
          <MaterialManager
            target="assignment"
            id={assignment.id}
            courseId={assignment.course_id}
            attachments={assignment.attachments ?? []}
          />
        )}
      </div>
      <button
        onClick={saveAssignEdit}
        disabled={saving}
        className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save assignment"}
      </button>
    </Modal>
  );
}
