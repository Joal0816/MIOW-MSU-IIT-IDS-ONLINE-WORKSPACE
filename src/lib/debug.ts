// Debug logging utility — toggle via VITE_DEBUG_LOGS=true in .env
// Usage: import { dbg } from "@/lib/debug"; dbg("auth", "PIN login clicked", { login });

const enabled = (() => {
  try {
    if (import.meta.env?.["VITE_DEBUG_LOGS"] === "true") return true;
    if (typeof process !== "undefined" && process.env?.["DEBUG_LOGS"] === "true") return true;
  } catch {
    /* import.meta.env unavailable — fall through to disabled */
  }
  return false;
})();

export function dbg(area: string, msg: string, data?: unknown) {
  if (!enabled) return;
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `[${ts}] [${area}]`;
  if (data !== undefined) {
    console.debug(prefix, msg, data);
  } else {
    console.debug(prefix, msg);
  }
}

export function dbgError(area: string, msg: string, err?: unknown) {
  if (!enabled) return;
  const ts = new Date().toISOString().slice(11, 23);
  console.error(`[${ts}] [${area}] ${msg}`, err);
}

export function dbgGroup(area: string, label: string) {
  if (!enabled) return;
  console.groupCollapsed(`[${area}] ${label}`);
}

export function dbgGroupEnd() {
  if (!enabled) return;
  console.groupEnd();
}
