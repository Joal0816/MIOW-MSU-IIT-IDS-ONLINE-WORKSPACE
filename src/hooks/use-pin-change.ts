import { useState } from "react";
import { toast } from "sonner";
import { findProfileByCredential, updateSessionProfile } from "@/lib/lms";
import { logAudit } from "@/lib/settings";

export function usePinChange({
  profile,
  pinRegex,
  pinLabel,
  updateFn,
  auditLabel,
}: {
  profile: {
    id: string;
    email?: string | null;
    student_id?: string | null;
    full_name: string;
    session_token?: string;
  } | null;
  pinRegex: RegExp;
  pinLabel: string;
  updateFn: (patch: { pin: string }) => Promise<void>;
  auditLabel: string;
}) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  const changePin = async () => {
    if (!profile) return;
    if (!pinRegex.test(newPin)) {
      toast.error(`New PIN must be ${pinLabel}`);
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match");
      return;
    }
    setBusy(true);
    try {
      const login = profile.email ?? profile.student_id ?? "";
      const verified = await findProfileByCredential(login, oldPin);
      if (!verified) {
        toast.error("Current PIN is incorrect");
        return;
      }
      await updateFn({ pin: newPin });
      updateSessionProfile({
        session_token: verified.session_token ?? profile.session_token ?? "",
      });
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
      logAudit("PIN changed", `${profile.full_name} reset their ${auditLabel}`);
      toast.success("PIN updated successfully");
    } catch {
      toast.error("Could not update PIN — please try again");
    } finally {
      setBusy(false);
    }
  };

  return { oldPin, setOldPin, newPin, setNewPin, confirmPin, setConfirmPin, busy, changePin };
}
