/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-only chat memory helpers for ClassMate long-term recall (Task 22).
// Table: public.chat_memories (id, profile_id, summary, last_n_messages, created_at, updated_at)
// Access is service_role only (RLS enabled, no public policy).
import { db } from "@/integrations/db/client.server";

export interface ChatMemory {
  id: string;
  profile_id: string;
  summary: string;
  last_n_messages: unknown;
  created_at: string;
  updated_at: string | null;
}

export interface ChatMessageLite {
  role: string;
  content: string;
}

/**
 * Naive summarizer: keep it deterministic and cheap. For production you would
 * call the AI gateway to produce a compressed summary; here we build a short
 * extract from the last N messages so the migration and wiring can be verified
 * without an extra LLM call.
 */
export function summarizeChat(messages: ChatMessageLite[], maxChars = 800): string {
  if (!messages.length) return "";
  const tail = messages.slice(-20);
  const lines = tail.map((m) => {
    const role = m.role === "user" ? "Student" : m.role === "assistant" ? "ClassMate" : m.role;
    const content = String(m.content ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
    return `${role}: ${content}`;
  });
  const joined = lines.join(" | ");
  return joined.slice(0, maxChars);
}

/**
 * Fetch the most recent memory for a profile, if any.
 */
export async function getMemory(profileId: string): Promise<ChatMemory | null> {
  const { data, error } = await db
    .from("chat_memories")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[chat-memory] getMemory error:", error);
    return null;
  }
  return (data as ChatMemory | null) ?? null;
}

/**
 * Insert or update the memory row for a profile.
 * Keeps one row per profile (upsert on profile_id unique assumption via delete+insert
 * if no unique constraint exists).
 */
export async function upsertMemory(
  profileId: string,
  summary: string,
  lastNMessages: unknown = null,
): Promise<ChatMemory | null> {
  const normalized = summary.trim().slice(0, 4000);
  if (!normalized) return getMemory(profileId);

  // Try to find existing row
  const existing = await getMemory(profileId);
  const payload: Record<string, unknown> = {
    profile_id: profileId,
    summary: normalized,
    last_n_messages: lastNMessages as any,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { data, error } = await db
      .from("chat_memories")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("[chat-memory] upsertMemory update error:", error);
      return null;
    }
    return data as ChatMemory;
  }

  const { data, error } = await db
    .from("chat_memories")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    console.error("[chat-memory] upsertMemory insert error:", error);
    return null;
  }
  return data as ChatMemory;
}
