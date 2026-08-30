import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for the student portal. The dashboard body lives in
// dashboard.student.index.tsx; child pages (grades, assignments, quizzes,
// attendance, settings) mount through <Outlet />.
export const Route = createFileRoute("/dashboard/student")({
  component: StudentLayout,
});

function StudentLayout() {
  return <Outlet />;
}
