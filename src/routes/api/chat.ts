// ClassMate Assistant streaming chat endpoint.
// The browser sends the signed kiosk session token; the caller's profile is
// resolved from it server-side, so chat tools always reflect the real role —
// a client can no longer pass an arbitrary profile id to impersonate anyone.
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

type ChatRequestBody = {
  messages?: unknown;
  token?: unknown;
  worksheetContext?: unknown;
};

/** Sanitize the optional Create Worksheet form context (course/title/sourceMaterial). */
function parseWorksheetContext(raw: unknown): { course?: string; title?: string; sourceMaterial?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const course = typeof o["course"] === "string" ? o["course"].slice(0, 200) : undefined;
  const title = typeof o["title"] === "string" ? o["title"].slice(0, 200) : undefined;
  const sourceMaterial = typeof o["sourceMaterial"] === "string" ? o["sourceMaterial"].slice(0, 15000) : undefined;
  if (!course && !title && !sourceMaterial) return undefined;
  const ctx: { course?: string; title?: string; sourceMaterial?: string } = {};
  if (course) ctx.course = course;
  if (title) ctx.title = title;
  if (sourceMaterial) ctx.sourceMaterial = sourceMaterial;
  return ctx;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatRequestBody;
        try {
          body = (await request.json()) as ChatRequestBody;
        } catch {
          return new Response("Invalid JSON body", { status: 400 });
        }
        const { messages, token } = body;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        if (typeof token !== "string" || token.length === 0) {
          return new Response("Sign in to chat", { status: 401 });
        }

        const key = process.env["AI_GATEWAY_KEY"] ?? process.env["OPENAI_API_KEY"];
        if (!key) {
          return new Response("Missing AI_GATEWAY_KEY", { status: 500 });
        }

        // Server-only modules are loaded inside the handler so this route
        // module stays import-safe for the client bundle.
        const [{ requireSession }, { buildChatTools, systemPromptFor }, gateway] = await Promise.all([
          import("@/lib/lms.server"),
          import("@/lib/chat-tools.server"),
          import("@/lib/ai-gateway.server"),
        ]);

        let profile;
        try {
          profile = await requireSession(token);
        } catch {
          return new Response("Session expired — please sign in again", { status: 401 });
        }

        const provider = gateway.createAiGatewayProvider(
          key,
          gateway.getAiGatewayRunId(request),
        );
        const model = provider("google/gemini-3.7-flash");

        const result = streamText({
          model,
          system: systemPromptFor(profile, parseWorksheetContext(body.worksheetContext)),
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: buildChatTools(profile),
          stopWhen: stepCountIs(6),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
          headers: gateway.getAiGatewayResponseHeaders(undefined),
        });
      },
    },
  },
});
