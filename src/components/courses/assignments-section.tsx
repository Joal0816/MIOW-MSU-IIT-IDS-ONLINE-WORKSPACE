import { Pencil, Trash2 } from "lucide-react";
import { type Assignment, type Course, COMPONENT_LABELS } from "@/lib/lms";
import { MotionCard, courseStyle } from "@/components/lms";
import { MaterialManager } from "@/components/courses/material-manager";
import { cn } from "@/lib/utils";

interface AssignmentsSectionProps {
  assignments: Assignment[];
  courses: Course[];
  onEdit: (assignment: Assignment) => void;
  onRemove: (assignment: Assignment) => void;
}

export function AssignmentsSection({
  assignments,
  courses,
  onEdit,
  onRemove,
}: AssignmentsSectionProps) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold">Assignments</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Edit instructions, attach handouts, or archive posted work.
      </p>
      <div className="mt-3 grid gap-2">
        {assignments.map((a) => {
          const course = courses.find((c) => c.id === a.course_id);
          const st = courseStyle(course?.color ?? "indigo");
          return (
            <MotionCard key={a.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", st.soft)}>
                {course?.code ?? "—"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  {COMPONENT_LABELS[a.component_type]} · {a.total_points} pts
                  {a.due_date
                    ? ` · due ${new Date(a.due_date).toLocaleDateString()}`
                    : " · no due date"}
                </p>
              </div>
              <button
                onClick={() => onEdit(a)}
                aria-label={`Edit assignment ${a.title}`}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              <button
                onClick={() => onRemove(a)}
                aria-label={`Remove assignment ${a.title}`}
                className="flex h-9 items-center rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="w-full">
                <MaterialManager
                  target="assignment"
                  id={a.id}
                  courseId={a.course_id}
                  attachments={a.attachments ?? []}
                />
              </div>
            </MotionCard>
          );
        })}
      </div>
    </section>
  );
}
