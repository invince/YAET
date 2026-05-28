class SessionRegistry {
  constructor(options = {}) {
    this._sessions = new Map();
    this._maxBufferLines = options.maxBufferLines || 50;
  }

  get maxBufferLines() {
    return this._maxBufferLines;
  }

  set maxBufferLines(n) {
    if (n >= 10) this._maxBufferLines = n;
  }

  register(id, type, owner, session, chatSessionId) {
    const entry = {
      id,
      type,
      owner,
      session,
      chatSessionId,
      buffer: [],
      createdAt: Date.now(),
    };

    session.on('output', ({ data }) => {
      entry.buffer.push({ ts: Date.now(), data });
      if (entry.buffer.length > this._maxBufferLines) {
        entry.buffer.splice(0, entry.buffer.length - this._maxBufferLines);
      }
    });

    session.on('disconnect', () => {
      this.unregister(id);
    });

    this._sessions.set(id, entry);
  }

  unregister(id) {
    this._sessions.delete(id);
  }

  get(id) {
    return this._sessions.get(id);
  }

  list(owner) {
    const result = [];
    for (const entry of this._sessions.values()) {
      if (owner && entry.owner !== owner) continue;
      result.push({
        id: entry.id,
        type: entry.type,
        owner: entry.owner,
        chatSessionId: entry.chatSessionId,
        runningSince: entry.createdAt,
      });
    }
    return result;
  }

  read(id, lastN) {
    const entry = this._sessions.get(id);
    if (!entry) return null;

    const n = lastN || this._maxBufferLines;
    const output = entry.buffer.slice(-n);
    const isRunning = entry.session._connected !== undefined
      ? entry.session._connected
      : true;

    return {
      id: entry.id,
      type: entry.type,
      owner: entry.owner,
      running: isRunning,
      output,
    };
  }
}

module.exports = { SessionRegistry };
