/*
 * Form-to-Chat state sync for the ClassMate Assistant.
 * The Create Worksheet form (admin courses page) publishes the currently
 * selected course + worksheet title here; the chat widget injects them into
 * the request payload so generation stays strictly scoped to the active form.
 */

export interface WorksheetAssistContext {
  /** e.g. "MATH10 — Mathematics 10" */
  course: string;
  /** Worksheet title typed into the form (may be empty). */
  title: string;
}

export const WORKSHEET_CHAT_EVENT = "ids:open-worksheet-chat";

/** Open the chat widget scoped to the active Create Worksheet form. */
export function openWorksheetChat(ctx: WorksheetAssistContext) {
  window.dispatchEvent(new CustomEvent<WorksheetAssistContext>(WORKSHEET_CHAT_EVENT, { detail: ctx }));
}
