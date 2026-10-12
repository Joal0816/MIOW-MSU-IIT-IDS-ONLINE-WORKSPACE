import { useEffect, useState, useCallback, useRef } from "react";

export interface AssessmentViolation {
  count: number;
  reason: string;
  timestamp: string;
}

interface LockdownOptions {
  enabled: boolean;
  maxViolations?: number;
  onMaxViolationsReached?: () => void;
  onViolation?: (count: number, reason: string, logs: AssessmentViolation[]) => void;
}

export function useAssessmentLockdown({
  enabled,
  maxViolations = 3,
  onMaxViolationsReached,
  onViolation,
}: LockdownOptions) {
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [violationLogs, setViolationLogs] = useState<AssessmentViolation[]>([]);

  const violationCountRef = useRef(0);
  const violationLogsRef = useRef<AssessmentViolation[]>([]);
  const callbacksRef = useRef({ onMaxViolationsReached, onViolation });
  callbacksRef.current = { onMaxViolationsReached, onViolation };

  const triggerViolation = useCallback((reason: string) => {
    violationCountRef.current += 1;
    const current = violationCountRef.current;
    const newEntry: AssessmentViolation = {
      count: current,
      reason,
      timestamp: new Date().toLocaleTimeString(),
    };
    violationLogsRef.current = [...violationLogsRef.current, newEntry];

    setViolations(current);
    setLastWarning(reason);
    setViolationLogs(violationLogsRef.current);

    callbacksRef.current.onViolation?.(current, reason, violationLogsRef.current);

    if (current >= maxViolations) {
      callbacksRef.current.onMaxViolationsReached?.();
    }
  }, [maxViolations]);

  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browsers might deny if not user-gesture triggered
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore exit errors
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      violationCountRef.current = 0;
      violationLogsRef.current = [];
      setViolations(0);
      setViolationLogs([]);
      setLastWarning(null);
      return;
    }

    // Check initial fullscreen
    setIsFullscreen(!!document.fullscreenElement);

    // 1. Tab visibility change & window blur
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("Tab switched or minimized");
      }
    };

    const handleWindowBlur = () => {
      // Some browsers fire blur when interacting with select/inputs or clicking fullscreen prompts,
      // so we check document.activeElement before penalizing.
      if (!document.hidden && document.activeElement?.tagName !== "IFRAME") {
        triggerViolation("Window lost focus");
      }
    };

    // 2. Fullscreen change
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      if (!active) {
        triggerViolation("Exited fullscreen mode");
      }
    };

    // 3. Prevent devtools, inspect, print, copy-paste shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 or Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C (DevTools)
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) ||
        (e.metaKey && e.altKey && ["I", "i", "J", "j", "C", "c"].includes(e.key))
      ) {
        e.preventDefault();
        triggerViolation("Attempted to inspect page / devtools");
        return;
      }

      // Ctrl+P / Cmd+P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        return;
      }

      // Alt+Tab cannot be cancelled by browser, but we catch Alt key press
      if (e.key === "Alt" || e.key === "Meta") {
        // Warning only
      }
    };

    // 4. Disable context menu (right click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 5. Prevent copy & paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    // 6. Push state loop to trap browser back button
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
      triggerViolation("Attempted browser back navigation");
    };
    window.history.pushState(null, "", window.location.href);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("paste", handlePaste);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, triggerViolation]);

  return {
    violations,
    violationLogs,
    isFullscreen,
    lastWarning,
    clearWarning: () => setLastWarning(null),
    enterFullscreen,
    exitFullscreen,
  };
}
