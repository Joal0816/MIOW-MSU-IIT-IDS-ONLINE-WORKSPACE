/*
 * Assessment integrity mode — a tiny global store that student pages flip on
 * while a Worksheet, Assignment, or Exam is actively being taken. Peer-help
 * surfaces (the ClassMate Assistant chat widget) subscribe and hide themselves
 * for the duration of the assessment.
 */
import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

/** Enter/exit assessment mode. Safe to call repeatedly with the same value. */
export function setAssessmentMode(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True while the student is actively taking an assessment. */
export function useAssessmentMode(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false, // server snapshot: never in assessment mode during SSR
  );
}
