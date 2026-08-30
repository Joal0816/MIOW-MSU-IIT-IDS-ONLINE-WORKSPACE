/**
 * Pedagogical labels — keep DB `assignments` table unchanged.
 * UI uses Activity / Activities / Worksheet instead of Assignment / Quiz.
 */
export const LABEL_ASSIGNMENT = "Activity";
export const LABEL_ASSIGNMENTS = "Activities";
export const LABEL_QUIZ = "Worksheet";

// Optional helpers
export const LABELS = {
  assignment: LABEL_ASSIGNMENT,
  assignments: LABEL_ASSIGNMENTS,
  quiz: LABEL_QUIZ,
} as const;
