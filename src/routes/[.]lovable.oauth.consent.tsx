/* eslint-disable @typescript-eslint/no-explicit-any */
// OAuth consent screen for the MIOW Connect MCP server.
// External AI clients (ChatGPT, Claude, …) send the user here to approve
// access. The app has no cloud-account login page (kiosk auth only), so this
// route renders its own school-email sign-in and then the consent decision.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Beta auth.oauth namespace — tiny local typed wrapper over the client methods.
type OAuthDetails = {
  client?: { name?: string | null; uri?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scopes?: string[] | null;
};
type OAuthResult = { data: OAuthDetails | null; error: { message: string } | null };
const oauth = (supabase.auth as any).oauth as {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase client reads its session from localStorage,
  // which is absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Connect an App | MIOW - MSU-IIT IDS Online Workspace" },
      {
        name: "description",
        content:
          "Authorize an AI assistant to use MIOW as you — scoped to your own school account.",
      },
    ],
  }),
  component: ConsentPage,
});

type Phase = "loading" | "auth" | "consent";

function ConsentPage() {
  const { authorization_id } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>("loading");
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sign-in form state
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function loadDetails() {
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setPhase("auth");
      return;
    }
    setAccountEmail(session.user.email ?? null);
    const { data, error: detailsError } = await oauth.getAuthorizationDetails(authorization_id);
    if (detailsError) {
      setError(detailsError.message);
      setPhase("consent");
      return;
    }
    // Already-approved client: the provider resolves immediately — bounce to it.
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return;
    }
    setDetails(data);
    setPhase("consent");
  }

  useEffect(() => {
    if (!authorization_id) {
      setError("Missing authorization_id. Start the connection from your AI assistant again.");
      setPhase("consent");
      return;
    }
    void loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorization_id]);

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      await loadDetails();
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (data.session) {
        await loadDetails();
      } else {
        setInfo("Account created. Confirm your email address, then come back here and sign in.");
        setMode("signin");
      }
    }
  }

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: decideError } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  async function switchAccount() {
    await supabase.auth.signOut();
    setDetails(null);
    setAccountEmail(null);
    setPhase("auth");
  }

  const clientName = details?.client?.name ?? "an AI assistant";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-card-foreground">MIOW Connect</p>
            <p className="text-xs text-muted-foreground">Agent integration authorization</p>
          </div>
        </div>

        {phase === "loading" && (
          <p className="text-sm text-muted-foreground">Loading authorization request…</p>
        )}

        {phase === "auth" && (
          <div>
            <h1 className="font-display text-xl font-semibold text-card-foreground">
              Sign in to continue
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the school email on your MIOW profile. The connected assistant will
              only see what your account is allowed to see.
            </p>
            <form onSubmit={submitAuth} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@student.northview.edu"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {info && <p className="text-sm text-success">{info}</p>}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setInfo(null);
              }}
              className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {mode === "signin"
                ? "First time connecting? Create an account with your school email"
                : "Already have an account? Sign in"}
            </button>
          </div>
        )}

        {phase === "consent" && !error && details && (
          <div>
            <h1 className="font-display text-xl font-semibold text-card-foreground">
              Connect {clientName} to MIOW
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This lets {clientName} call this app's tools while acting as you.
            </p>
            <div className="mt-5 space-y-2 rounded-xl border border-border bg-muted/50 p-4 text-sm">
              <p className="flex items-center gap-2 text-card-foreground">
                <ShieldCheck className="h-4 w-4 text-success" /> Share your basic profile and email
              </p>
              <p className="flex items-center gap-2 text-card-foreground">
                <ShieldCheck className="h-4 w-4 text-success" /> Read school announcements and
                courses
              </p>
              <p className="flex items-center gap-2 text-card-foreground">
                <ShieldCheck className="h-4 w-4 text-success" /> Access grades, attendance, and
                assignments as your role allows
              </p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-card-foreground">{accountEmail}</span>
              {" · "}
              <button onClick={switchAccount} className="underline underline-offset-2">
                Switch account
              </button>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This does not bypass the app's permissions or backend policies.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Working…" : "Approve"}
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-card-foreground transition hover:bg-muted disabled:opacity-50"
              >
                Cancel connection
              </button>
            </div>
          </div>
        )}

        {phase === "consent" && error && (
          <div>
            <h1 className="font-display text-xl font-semibold text-card-foreground">
              Could not load this authorization request
            </h1>
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Go back to your AI assistant and start the connection again.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
