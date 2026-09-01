// Google Docs integration — Picker + Docs API export.
// Requires VITE_GOOGLE_CLIENT_ID (OAuth) + VITE_GOOGLE_API_KEY (Picker).
// All code is client-only; dynamically loads GAPI + GIS at runtime.

const GIS_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";
const GAPI_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? "";
const GAPI_DISCOVERY = "https://www.googleapis.com/discovery/v1/apis/docs/v1/rest";
const PICKER_SCOPE = "https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/drive.readonly";

// ── Lazy-loaded singletons ──────────────────────────────────────────

let gapiReady: Promise<void> | null = null;
let gisReady: Promise<void> | null = null;
let accessToken: string | null = null;

/** Load gapi client + picker via script tag. Returns when loaded. */
function ensureGapi(): Promise<void> {
  if (gapiReady) return gapiReady;
  gapiReady = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = () => {
      // Load client first, then picker — they're separate modules
      (window as any).gapi.load("client", () => {
        (window as any).gapi.client.init({
          apiKey: GAPI_KEY,
          discoveryDocs: [GAPI_DISCOVERY],
        }).then(() => {
          // Now load the picker module
          (window as any).gapi.load("picker", () => resolve());
        }, reject);
      });
    };
    s.onerror = () => reject(new Error("Failed to load gapi"));
    document.head.appendChild(s);
  });
  return gapiReady;
}

/** Load Google Identity Services (GIS) for OAuth token flow. */
function ensureGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load GIS"));
    document.head.appendChild(s);
  });
  return gisReady;
}

/** Request an OAuth token via GIS consent popup. */
async function requestToken(): Promise<string> {
  if (accessToken) return accessToken;
  await ensureGis();
  return new Promise<string>((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GIS_CLIENT_ID,
      scope: PICKER_SCOPE,
      callback: (resp: any) => {
        if (resp.error) return reject(new Error(resp.error));
        accessToken = resp.access_token;
        resolve(accessToken!);
      },
    });
    client.requestAccessToken();
  });
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Opens the Google Picker for Docs. Requires VITE_GOOGLE_CLIENT_ID and
 * VITE_GOOGLE_API_KEY. On pick, calls `onPick` with the selected doc IDs.
 * Returns a cleanup function to dismiss the picker if needed.
 */
export function openGooglePicker(onPick: (docIds: string[]) => void): void {
  if (!GIS_CLIENT_ID || !GAPI_KEY) {
    console.warn("[google-docs] VITE_GOOGLE_CLIENT_ID / VITE_GOOGLE_API_KEY not set — using paste fallback");
    return;
  }

  (async () => {
    const token = await requestToken();
    await ensureGapi();
    const gapi = (window as any).gapi;
    const picker = new google.picker.PickerBuilder()
      .addView(google.picker.ViewId.DOCS)
      .setOAuthToken(token)
      .setDeveloperKey(GAPI_KEY)
      .setTitle("Select a Google Doc to import")
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const ids = (data.docs ?? []).map((d: any) => d.id).filter(Boolean);
          if (ids.length) onPick(ids);
        }
      })
      .build();
    picker.setVisible(true);
  })().catch((e) => {
    console.error("[google-docs] picker error:", e);
  });
}

/**
 * Export a Google Doc as plain text via the Docs API.
 * Requires an active OAuth token (requestToken is called automatically).
 */
export async function exportDocAsText(docId: string): Promise<string> {
  if (!GIS_CLIENT_ID || !GAPI_KEY) {
    console.warn("[google-docs] VITE_GOOGLE_CLIENT_ID / VITE_GOOGLE_API_KEY not set");
    return "";
  }

  const token = await requestToken();
  await ensureGapi();

  // Fetch the doc structure via REST (gapi.client wraps fetch)
  const resp = await (window as any).gapi.client.docs.documents.get({ documentId: docId });
  const doc = resp.result;

  // Flatten all text content from body.content → paragraphs → textRun
  const lines: string[] = [];
  const body = doc.body?.content ?? [];
  for (const el of body) {
    const para = el.paragraph;
    if (!para?.elements) continue;
    const text = para.elements
      .map((e: any) => e.textRun?.content ?? "")
      .join("");
    if (text.trim()) lines.push(text.trimEnd());
  }
  return lines.join("\n");
}

/** Preview helper: converts pasted markdown into a short preview (first 800 chars). */
export function previewMarkdown(md: string, max = 800): string {
  return md.length > max ? md.slice(0, max) + "…" : md;
}
