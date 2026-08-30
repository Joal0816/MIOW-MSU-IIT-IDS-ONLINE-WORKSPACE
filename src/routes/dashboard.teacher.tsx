import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for /dashboard/teacher/* — teacher portal. Child routes (index, students, settings) mount via <Outlet />.
export const Route = createFileRoute("/dashboard/teacher")({
  component: TeacherLayout,
});

function TeacherLayout() {
  return <Outlet />;
}
