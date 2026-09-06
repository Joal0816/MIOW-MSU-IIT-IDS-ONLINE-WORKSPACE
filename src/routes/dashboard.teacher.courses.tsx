import { createFileRoute } from "@tanstack/react-router";
import { CoursesPage } from "./dashboard.admin.courses";

export const Route = createFileRoute("/dashboard/teacher/courses")({
  head: () => ({
    meta: [
      { title: "Courses | MIOW - Integrated Developmental School" },
      { name: "description", content: "Manage courses, assignments and worksheets." },
    ],
  }),
  component: CoursesPage,
});
