// ClassMate Assistant streaming chat endpoint.
// Calls OpenCode Go directly (bypasses AI SDK streaming which breaks on reasoning models).
import { createFileRoute } from "@tanstack/react-router";

type ChatRequestBody = {
  messages?: unknown;
  token?: unknown;
  worksheetContext?: unknown;
};

function parseWorksheetContext(raw: unknown): { course?: string; title?: string } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const course = typeof o["course"] === "string" ? o["course"].slice(0, 200) : undefined;
  const title = typeof o["title"] === "string" ? o["title"].slice(0, 200) : undefined;
  if (!course && !title) return undefined;
  const ctx: { course?: string; title?: string } = {};
  if (course) ctx.course = course;
  if (title) ctx.title = title;
  return ctx;
}

/** Convert AI SDK UIMessage[] to OpenAI chat message format. */
function toOpenAIMessages(messages: any[], systemPrompt: string) {
  const out: Array<{ role: string; content: string }> = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      let text = "";
      if (typeof m.content === "string") text = m.content;
      else if (Array.isArray(m.parts)) {
        text = m.parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
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
          import("@/lib/lms.server"),
          import("@/lib/chat-tools.server"),
        ]);

        let profile;
        try {
          profile = await requireSession(token);
        } catch {
          return new Response("Session expired — please sign in again", { status: 401 });
        }

        const ctx = parseWorksheetContext(body.worksheetContext);
        const systemPrompt = systemPromptFor(profile, ctx);
        const oaMessages = toOpenAIMessages(messages, systemPrompt);

        // Call OpenCode Go directly
        const apiRes = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
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

        // Transform OpenCode Go SSE → AI SDK DataStream v1 format
        // Client expects: data: {"type":"text-start","id":"txt-0"}\n\n
        //                 data: {"type":"text-delta","id":"txt-0","delta":"chunk"}\n\n
        //                 data: {"type":"text-end","id":"txt-0"}\n\n
        //                 data: [DONE]\n\n
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let textStarted = false;
        let textId = 0;

        const transform = new TransformStream({
          transform(chunk, controller) {
            const raw = decoder.decode(chunk, { stream: true });
            const lines = raw.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                if (textStarted) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: `txt-${textId}` })}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Skip null/empty content (reasoning model reasoning phase)
                if (delta.content === null || delta.content === undefined) continue;
                if (delta.content === "") continue;

                // Start text part on first content chunk
                if (!textStarted) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: `txt-${textId}` })}\n\n`));
                  textStarted = true;
                }

                // Send text delta
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text-delta", id: `txt-${textId}`, delta: delta.content })}\n\n`));
              } catch {
                // skip unparseable chunks
              }
            }
          },
        });

        const body_ = apiRes.body!.pipeThrough(transform);

        return new Response(body_, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Vercel-AI-UI-Message-Stream": "v1",
          },
        });
      },
    },
  },
});
