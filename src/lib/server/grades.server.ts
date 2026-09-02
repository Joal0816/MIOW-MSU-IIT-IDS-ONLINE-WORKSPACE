/* eslint-disable @typescript-eslint/no-explicit-any */
// Grades — CRUD + DepEd transmutation.
import { z } from "zod";
import { db } from "@/integrations/db/client.server";
import { unwrap, withoutToken } from "@/lib/server/utils.server";
import { schemas } from "@/lib/server/schemas.server";

export async function listGradesForStudent(studentId: string) {
  return unwrap<any[]>(db.from("grades").select("*").eq("student_id", studentId));
}

export async function listGradesForCourse(courseId: string, quarter: number) {
  return unwrap<any[]>(
    db.from("grades").select("*").eq("course_id", courseId).eq("quarter", quarter),
  );
}

export async function upsertGrade(input: z.infer<typeof schemas.gradeInput>) {
  const existing = await unwrap<{ id: string } | null>(
    db
      .from("grades")
      .select("id")
      .eq("student_id", input.student_id)
      .eq("course_id", input.course_id)
      .eq("quarter", input.quarter)
      .maybeSingle(),
  );
  const row = withoutToken(input);
  if (existing) await unwrap(db.from("grades").update(row).eq("id", existing.id));
  else await unwrap(db.from("grades").insert(row));
}
