// Task 26: Google Docs helpers — stubs until GAPI/OAuth is wired.
// Flag: integrate only when Google Picker API credential is provisioned.

/**
 * Opens the Google Picker for Docs. Stub: logs a placeholder until `gapi`
 * is loaded and an OAuth token is available.
 * @param onPick called with the picked doc IDs
 */
export function openGooglePicker(_onPick: (docIds: string[]) => void): void {
  // GAPI placeholder — replace with gapi.load('picker', ...) + pickerBuilder
  // when VITE_GOOGLE_API_KEY / VITE_GOOGLE_CLIENT_ID are configured.
  console.warn("[google-docs] openGooglePicker stub — gapi not configured");
  // Example wiring (kept as comment for future implementation):
  // gapi.load('picker', () => {
  //   const picker = new google.picker.PickerBuilder()
  //     .addView(google.picker.ViewId.DOCS)
  //     .setOAuthToken(oauthToken)
  //     .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY)
  //     .setCallback((data) => { if (data.action === 'picked') onPick(data.docs.map(d=>d.id)) })
  //     .build();
  //   picker.setVisible(true);
  // });
}

/**
 * Export a Google Doc as plain text / markdown-like string.
 * Stub: resolves with empty string until Docs API export is wired.
 */
export async function exportDocAsText(_docId: string): Promise<string> {
  console.warn("[google-docs] exportDocAsText stub — not yet implemented");
  return "";
}

/** Preview helper: converts pasted markdown into a short preview (first 800 chars). */
export function previewMarkdown(md: string, max = 800): string {
  return md.length > max ? md.slice(0, max) + "…" : md;
}
