import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/lms";

interface ConfirmRemoveModalProps {
  target: { kind: "quiz" | "assignment"; id: string; title: string } | null;
  saving: boolean;
  onConfirm: (mode: "soft" | "hard") => void;
  onClose: () => void;
}

export function ConfirmRemoveModal({
  target,
  saving,
  onConfirm,
  onClose,
}: ConfirmRemoveModalProps) {
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Remove ${target?.kind === "quiz" ? "worksheet" : "assignment"}`}
    >
      <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          <span className="font-semibold">{target?.title}</span> — archiving hides it from students
          while keeping every score, attempt, and audit record. Permanent deletion also erases
          attached files and cannot be undone.
        </p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => onConfirm("soft")}
          disabled={saving}
          className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Archive (keep records)
        </button>
        <button
          onClick={() => onConfirm("hard")}
          disabled={saving}
          className="h-11 rounded-xl border border-rose-500/40 bg-rose-500/10 text-sm font-semibold text-rose-600 hover:bg-rose-500/15 disabled:opacity-50"
        >
          Delete permanently
        </button>
      </div>
    </Modal>
  );
}
