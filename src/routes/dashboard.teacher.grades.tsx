import { createFileRoute } from "@tanstack/react-router";
import { GradebookPage } from "./dashboard.admin.grades";

export const Route = createFileRoute("/dashboard/teacher/grades")({
  head: () => ({
    meta: [
      { title: "Gradebook | MIOW - Integrated Developmental School" },
      { name: "description", content: "Encode grades and track submissions." },
    ],
  }),
  component: GradebookPage,
});
