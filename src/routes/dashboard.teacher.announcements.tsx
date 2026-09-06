import { createFileRoute } from "@tanstack/react-router";
import { AnnouncementsPage } from "./dashboard.admin.announcements";

export const Route = createFileRoute("/dashboard/teacher/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements | MIOW - Integrated Developmental School" },
      { name: "description", content: "Manage announcements and notifications." },
    ],
  }),
  component: AnnouncementsPage,
});
