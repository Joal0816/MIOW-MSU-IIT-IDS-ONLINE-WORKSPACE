import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRfidScanner } from "@/hooks";
import { logAudit } from "@/lib/settings";

export function useRfidRebind({
  profile,
  updateFn,
  auditLabel,
  successMessage,
  errorMessage,
}: {
  profile: { full_name: string } | null;
  updateFn: (uid: string) => Promise<void>;
  auditLabel: string;
  successMessage: (uid: string) => string;
  errorMessage: string;
}) {
  const [listening, setListening] = useState(false);

  const rebind = useCallback(
    async (uid: string) => {
      if (!profile) return;
      try {
        await updateFn(uid);
        logAudit(auditLabel, `Card ••••${uid.slice(-4)} linked to ${profile.full_name}`);
        toast.success(successMessage(uid));
      } catch {
        toast.error(errorMessage);
      }
    },
    [profile, updateFn, auditLabel, successMessage, errorMessage],
  );

  useRfidScanner(
    useCallback(
      (uid: string) => {
        setListening(false);
        void rebind(uid);
      },
      [rebind],
    ),
    listening,
  );

  return { listening, setListening };
}
