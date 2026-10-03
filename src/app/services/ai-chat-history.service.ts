import {Injectable} from '@angular/core';

export interface ChatSession {
  id: string;
  name: string;
  messages: { role: string; content: string }[];
  createdAt: number;
  updatedAt: number;
  /** cumulative API token usage for this session (absent on old sessions) */
  tokens?: { prompt: number; completion: number; total: number };
  /** pinned chats sort first and survive trimming */
  pinned?: boolean;
  /** last agent-run tool activity (bounded, for review after switch/reload) */
  tools?: { toolName: string; args: any; result?: any; error?: string; ts: number; expanded?: boolean }[];
}

const STORAGE_KEY = 'yaet_ai_chat_sessions';
export const MAX_SESSIONS = 10;

@Injectable({ providedIn: 'root' })
export class AiChatHistoryService {
  private sessions: ChatSession[] = [];
  currentSessionId: string | null = null;
  // P2-2: how many old sessions the last createNew() dropped (0 = none).
  // The component reads + resets it to toast instead of silently discarding.
  lastTrimmedCount = 0;

  constructor() {
    this.load();
    if (!this.currentSessionId || !this.sessions.some(s => s.id === this.currentSessionId)) {
      this.createNew();
    }
  }

  get current(): ChatSession | null {
    return this.sessions.find(s => s.id === this.currentSessionId) ?? null;
  }

  get list(): ChatSession[] {
    // Pinned first, then most-recent — the stored order is arrival order.
    return [...this.sessions].sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updatedAt - a.updatedAt
    );
  }

  createNew(): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      name: 'New Chat',
      messages: [{ role: 'assistant', content: 'Hello! How can I help you today?' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.unshift(session);
    this.currentSessionId = session.id;
    this.lastTrimmedCount = this.trim();
    this.save();
    return session;
  }

  switchTo(id: string) {
    if (this.sessions.some(s => s.id === id)) {
      this.currentSessionId = id;
      this.save();
    }
  }

  saveCurrentMessages(messages: { role: string; content: string }[]) {
    const session = this.current;
    if (!session) return;
    session.messages = [...messages];
    session.updatedAt = Date.now();
    this.reorder();
    this.save();
  }

  renameSession(id: string, name: string) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    session.name = name;
    session.updatedAt = Date.now();
    this.save();
  }

  /** Accumulate one API usage report into the session totals. */
  addSessionTokens(id: string | null, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    if (!id) return;
    const session = this.sessions.find(s => s.id === id);
    if (!session || !usage) return;
    const t = session.tokens ?? (session.tokens = { prompt: 0, completion: 0, total: 0 });
    const p = usage.prompt_tokens || 0;
    const c = usage.completion_tokens || 0;
    t.prompt += p;
    t.completion += c;
    t.total += usage.total_tokens || (p + c);
    session.updatedAt = Date.now();
    this.save();
  }

  /** Zero the session totals (used when the conversation is cleared). */
  resetSessionTokens(id: string | null) {
    if (!id) return;
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    session.tokens = { prompt: 0, completion: 0, total: 0 };
    this.save();
  }

  remove(id: string) {
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.sessions.splice(idx, 1);
    if (this.currentSessionId === id) {
      // Follow display order (pinned first) rather than storage order.
      const next = this.list[0] ?? null;
      if (next) {
        this.currentSessionId = next.id;
      } else {
        this.createNew();
        return;
      }
    }
    this.save();
  }

  togglePin(id: string) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    session.pinned = !session.pinned;
    this.save();
  }

  /** Persist agent-run tool activity (bounded — tool outputs can be huge). */
  saveSessionTools(id: string | null, tools: { toolName: string; args: any; result?: any; error?: string; ts: number; expanded?: boolean }[]) {
    if (!id) return;
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    const cap = (v: any, max = 2000): any => {
      try {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return s.length > max ? s.slice(0, max) + `…[truncated ${(s.length - max).toLocaleString()} chars]` : v;
      } catch (_) {
        return '[unserializable]';
      }
    };
    session.tools = (tools || []).slice(-20).map(t => ({
      toolName: t.toolName,
      args: cap(t.args),
      result: t.result === undefined ? undefined : cap(t.result),
      error: t.error,
      ts: t.ts,
      expanded: !!t.expanded,
    }));
    this.save();
  }

  private reorder() {
    this.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private trim(): number {
    if (this.sessions.length > MAX_SESSIONS) {
      // Pinned sessions survive: trim the least-recently-updated unpinned.
      const pinned = this.sessions.filter(s => s.pinned);
      const rest = this.sessions.filter(s => !s.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const keepRest = Math.max(0, MAX_SESSIONS - pinned.length);
      const dropped = rest.length - keepRest;
      this.sessions = [...pinned, ...rest.slice(0, keepRest)];
      return Math.max(0, dropped);
    }
    return 0;
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sessions: this.sessions,
        currentSessionId: this.currentSessionId,
      }));
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.sessions = data.sessions ?? [];
        this.currentSessionId = data.currentSessionId ?? null;
      }
    } catch (e) {
      console.error('Failed to load chat history:', e);
    }
  }
}
