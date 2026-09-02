import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { enrollmentsForCourse } from "@/lib/lms";

export function EnrollmentCount({ courseId }: { courseId: string }) {
  const { data } = useQuery({
    queryKey: ["enrollments", courseId],
    queryFn: () => enrollmentsForCourse(courseId),
  });
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Plus className="hidden" />
      {data?.length ?? 0} students enrolled
    </p>
  );
}
