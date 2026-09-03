// Barrel re-export: preserves backward compatibility for all existing
// `import { X } from "@/components/lms"` patterns.
// New code should import directly from the specific module.

export { useProfile, useSignOut, useTheme, useRfidScanner } from "@/hooks";

export {
  ThemeToggle,
  Badge,
  attendanceTone,
  Card,
  MotionCard,
  FadeIn,
  ProgressBar,
  EmptyState,
  FilterTabs,
  courseStyle,
  COURSE_STYLE,
  CameraPanel,
  Modal,
} from "@/components/ui-elements";

export {
  type NavItem,
  STUDENT_NAV,
  ADMIN_NAV,
  TEACHER_NAV,
  staffNav,
  settingsPathFor,
  AppShell,
} from "@/components/sidebar";
