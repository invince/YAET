import {Injectable} from '@angular/core';

export interface ChatSession {
  id: string;
  name: string;
  messages: { role: string; content: string }[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'yaet_ai_chat_sessions';
const MAX_SESSIONS = 10;

@Injectable({ providedIn: 'root' })
export class AiChatHistoryService {
  private sessions: ChatSession[] = [];
  currentSessionId: string | null = null;

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
    return [...this.sessions];
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
    this.trim();
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

  remove(id: string) {
    const idx = this.sessions.findIndex(s => s.id === id);
    if (idx === -1) return;
    this.sessions.splice(idx, 1);
    if (this.currentSessionId === id) {
      const next = this.sessions[0] ?? null;
      if (next) {
        this.currentSessionId = next.id;
      } else {
        this.createNew();
        return;
      }
    }
    this.save();
  }

  private reorder() {
    this.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private trim() {
    if (this.sessions.length > MAX_SESSIONS) {
      this.sessions = this.sessions.slice(0, MAX_SESSIONS);
    }
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
