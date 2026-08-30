import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout route for the admin/teacher portal. The dashboard body lives in
// dashboard.admin.index.tsx; child pages (students, courses, gradebook,
// attendance kiosk, announcements, settings) mount through <Outlet />.
export const Route = createFileRoute("/dashboard/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
