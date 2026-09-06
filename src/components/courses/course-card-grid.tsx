import { Pencil, Trash2 } from "lucide-react";
import { type Course, type Profile, formatSchedule } from "@/lib/lms";
import { MotionCard, Badge, courseStyle } from "@/components/lms";
import { levelLabel } from "@/lib/course-levels";
import { EnrollmentCount } from "@/components/courses/enrollment-count";
import { cn } from "@/lib/utils";

interface CourseCardGridProps {
  courses: Course[];
  profile: Profile;
  isAdmin: boolean;
  onEdit: (course: Course) => void;
  onRemove: (course: Course) => void;
}

export function CourseCardGrid({
  courses,
  profile,
  isAdmin,
  onEdit,
  onRemove,
}: CourseCardGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c, i) => {
        const st = courseStyle(c.color);
        return (
          <MotionCard key={c.id} delay={Math.min(i * 0.05, 0.3)} className="overflow-hidden">
            <div className={cn("h-2", st.chip)} />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">{c.code}</p>
                <div className="flex items-center gap-1">
                  <Badge tone="slate">{levelLabel(c.grade_level)}</Badge>
                  {(isAdmin || c.teacher_id === profile.id) && (
                    <button
                      onClick={() => onEdit(c)}
                      title="Edit course"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => onRemove(c)}
                      title="Delete course"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 flex items-center gap-2 font-semibold leading-snug">
                <span>{c.title}</span>
                <Badge tone="indigo">{levelLabel(c.grade_level)}</Badge>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.teacher_name ?? "No teacher assigned"}
              </p>
              {formatSchedule(c) && (
                <p className="mt-1 text-xs font-medium text-primary">{formatSchedule(c)}</p>
              )}
              <EnrollmentCount courseId={c.id} />
            </div>
          </MotionCard>
        );
      })}
    </div>
  );
}
