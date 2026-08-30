export const COURSE_LEVELS = [
  { value: 7 as const, label: "Grade 7 (G7)" },
  { value: 8 as const, label: "Grade 8 (G8)" },
  { value: 9 as const, label: "Grade 9 (G9)" },
  { value: 10 as const, label: "Grade 10 (G10)" },
  { value: 11 as const, label: "Grade 11 (G11)" },
  { value: 12 as const, label: "Grade 12 (G12)" },
  { value: 13 as const, label: "College — 1st Year" },
  { value: 14 as const, label: "College — 2nd Year" },
  { value: 15 as const, label: "College — 3rd Year" },
  { value: 16 as const, label: "College — 4th Year" },
] as const;

export type CourseLevel = (typeof COURSE_LEVELS)[number]["value"];

export function levelLabel(v: number): string {
  return COURSE_LEVELS.find((l) => l.value === v)?.label ?? `Level ${v}`;
}

/** Map grade_level 7-16 to education_level. */
export function educationLevelOf(gradeLevel: number): "jhs" | "shs" | "college" {
  if (gradeLevel >= 13) return "college";
  if (gradeLevel >= 11) return "shs";
  return "jhs";
}

/** College year 1-4 for grade_level 13-16, null otherwise. */
export function collegeYearOf(gradeLevel: number): number | null {
  if (gradeLevel >= 13 && gradeLevel <= 16) return gradeLevel - 12;
  return null;
}
