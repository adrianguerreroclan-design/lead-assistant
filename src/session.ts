import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface Session {
  id: string;
  messages: MessageParam[];
  followUpCount: number;
  lastActivity: number;
  pendingMessages: { role: "assistant"; content: string }[];
}

const sessions = new Map<string, Session>();

export function createSession(id: string): Session {
  const session: Session = {
    id,
    messages: [],
    followUpCount: 0,
    lastActivity: Date.now(),
    pendingMessages: [],
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getOrCreateSession(id: string): Session {
  return sessions.get(id) ?? createSession(id);
}

export function touch(id: string): void {
  const s = sessions.get(id);
  if (s) s.lastActivity = Date.now();
}

export function allSessions(): Session[] {
  return Array.from(sessions.values());
}

export function pushPending(sessionId: string, text: string): void {
  const s = getOrCreateSession(sessionId);
  s.pendingMessages.push({ role: "assistant", content: text });
}

export function drainPending(sessionId: string): { role: "assistant"; content: string }[] {
  const s = sessions.get(sessionId);
  if (!s) return [];
  const msgs = [...s.pendingMessages];
  s.pendingMessages = [];
  return msgs;
}
