import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  dashboardPathFor,
  loadSession,
  refreshSessionProfile,
  saveSession,
  subscribeProfile,
  type Role,
} from "@/lib/lms";

const THEME_KEY = "northview-theme";

export function useProfile(roles?: Role[]) {
  const [profile, setProfile] = useState<import("@/lib/lms").Profile | null>(null);
  const navigate = useNavigate();
  const roleKey = roles?.join(",") ?? "";
  useEffect(() => {
    const sync = () => {
      const p = loadSession();
      const allowed = roleKey ? (roleKey.split(",") as Role[]) : undefined;
      if (!p) {
        navigate({ to: "/auth", replace: true });
      } else if (allowed && !allowed.includes(p.role)) {
        navigate({ to: dashboardPathFor(p.role), replace: true });
      } else {
        setProfile(p);
      }
    };
    sync();
    void refreshSessionProfile();
    return subscribeProfile(sync);
  }, [roleKey, navigate]);
  return profile;
}

export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return () => {
    saveSession(null);
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  };
}

export function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        /* private mode */
      }
      return next;
    });
  }, []);
  return { dark, toggle };
}

export function useRfidScanner(onScan: (uid: string) => void, enabled = true) {
  const buffer = useRef("");
  const lastKey = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKey.current > 300) buffer.current = "";
      lastKey.current = now;
      if (/^\d$/.test(e.key)) {
        buffer.current += e.key;
      } else if (e.key === "Enter") {
        const uid = buffer.current;
        buffer.current = "";
        if (uid.length >= 10 && uid.length <= 13) onScan(uid);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onScan, enabled]);
}
