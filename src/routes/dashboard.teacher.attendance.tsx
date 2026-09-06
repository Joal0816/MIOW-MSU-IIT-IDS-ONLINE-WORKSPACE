import { createFileRoute } from "@tanstack/react-router";
import { AttendanceKiosk } from "./dashboard.admin.attendance";

export const Route = createFileRoute("/dashboard/teacher/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance | MIOW - Integrated Developmental School" },
      { name: "description", content: "View taps and manage the gate attendance log." },
    ],
  }),
  component: AttendanceKiosk,
});
