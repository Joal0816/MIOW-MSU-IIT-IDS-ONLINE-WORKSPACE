/**
 * MIOW visual identity constants — the single source of truth for brand strings.
 * UI must read these instead of hardcoding names so a future rename is one edit.
 */
export const APP_NAME = "MSU-IIT IDS ONLINE WORKSPACE (MIOW)";
export const APP_SHORT_NAME = "MIOW";
export const APP_COMPACT_NAME = "MSU-IIT IDS";
export const APP_DESCRIPTOR = "MSU-IIT IDS ONLINE WORKSPACE";
export const APP_TAGLINE = "Integrated Development School – Online Workspace";
export const KIOSK_TITLE = "MIOW Attendance Kiosk";
export const KIOSK_EVENT_HEADER = "MIOW ATTENDANCE: MSU-IIT IDS ONLINE WORKSPACE";
export const NOTIFICATION_SIGNOFF = "Sincerely,\nThe MIOW Administration Team";

/** Official system palette (locked — see identity system). */
export const BRAND_COLORS = {
  maroon: "#800000",
  gold: "#FFD700",
  navy: "#0D1B2A",
  white: "#FFFFFF",
} as const;

/** Official logomark asset. Branding settings must not allow overriding this. */
export const BRAND_LOGO_SRC = "/miow-logo.svg";
export const BRAND_ICON_SRC = "/favicon.svg";

export const pageTitle = (page: string) => `${page} | MIOW - MSU-IIT IDS Online Workspace`;
