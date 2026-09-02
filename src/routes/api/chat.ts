// ClassMate Assistant streaming chat endpoint.
// Calls OpenCode Go directly with mimo-v2.5 (bypasses AI SDK streaming for reasoning models).
import { createFileRoute } from "@tanstack/react-router";

type ChatRequestBody = {
  messages?: unknown;
  token?: unknown;
  worksheetContext?: unknown;
};

/** Sanitize the optional Create Worksheet form context (course/title/sourceMaterial). */
function parseWorksheetContext(
  raw: unknown,
): { course?: string; title?: string; sourceMaterial?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const course = typeof o["course"] === "string" ? o["course"].slice(0, 200) : undefined;
  const title = typeof o["title"] === "string" ? o["title"].slice(0, 200) : undefined;
  const sourceMaterial =
    typeof o["sourceMaterial"] === "string" ? o["sourceMaterial"].slice(0, 15000) : undefined;
  if (!course && !title && !sourceMaterial) return undefined;
  const ctx: { course?: string; title?: string; sourceMaterial?: string } = {};
  if (course) ctx.course = course;
  if (title) ctx.title = title;
  if (sourceMaterial) ctx.sourceMaterial = sourceMaterial;
  return ctx;
}

interface ChatMessage {
  role: "user" | "assistant";
  content?: string;
  parts?: Array<{ type?: string; text?: string }>;
}

function toOpenAIMessages(messages: ChatMessage[], systemPrompt: string) {
  const out: Array<{ role: string; content: string }> = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      let text = "";
      if (typeof m.content === "string") text = m.content;
      else if (Array.isArray(m.parts)) {
        text = m.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("");
      }
      if (text.trim()) out.push({ role: m.role, content: text });
    }
  }
  return out;
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

        const apiKey = process.env["OPENCODE_API_KEY"] ?? process.env["AI_GATEWAY_KEY"];
        if (!apiKey) {
          return new Response("Missing OPENCODE_API_KEY", { status: 500 });
        }

        const [{ requireSession }, { systemPromptFor }] = await Promise.all([
          import("@/lib/server"),
          import("@/lib/chat-tools.server"),
        ]);

        let profile;
        try {
          profile = await requireSession(token);
        } catch {
          return new Response("Session expired — please sign in again", { status: 401 });
        }

        const ctx = parseWorksheetContext(body.worksheetContext);
        const oaMessages = toOpenAIMessages(messages, systemPromptFor(profile, ctx));

        const apiRes = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mimo-v2.5",
            messages: oaMessages,
            stream: true,
            max_tokens: 4096,
          }),
        });

        if (!apiRes.ok) {
          const err = await apiRes.text();
          console.error("[chat] OpenCode Go error:", apiRes.status, err);
          return new Response(`AI service error: ${apiRes.status}`, { status: 502 });
        }

        // Buffer-based SSE parser — handles TCP packet splits correctly
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let textStarted = false;
        const textId = 0;
        let buffer = "";

        const transform = new TransformStream({
          transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            let nlIdx;
            while ((nlIdx = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, nlIdx).trim();
              buffer = buffer.slice(nlIdx + 1);
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                if (textStarted) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "text-end", id: `txt-${textId}` })}\n\n`,
                    ),
                  );
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed: { choices?: Array<{ delta?: { content?: string } }> } =
                  JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;
                if (delta.content === null || delta.content === undefined) continue;
                if (delta.content === "") continue;
                if (!textStarted) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: "text-start", id: `txt-${textId}` })}\n\n`,
                    ),
                  );
                  textStarted = true;
                }
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text-delta", id: `txt-${textId}`, delta: delta.content })}\n\n`,
                  ),
                );
              } catch {
                /* skip malformed SSE lines */
              }
            }
          },
        });

        const body_ = apiRes.body!.pipeThrough(transform);
        return new Response(body_, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Vercel-AI-UI-Message-Stream": "v1",
          },
        });
      },
    },
  },
});
