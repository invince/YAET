const DEFAULT_DANGEROUS_COMMANDS = ['rm', 'dd', 'shutdown', 'reboot', 'mkfs', 'fdisk', 'format', 'sudo', 'su', 'passwd', 'kill', 'pkill', 'systemctl'];
const DEFAULT_DANGEROUS_PATTERNS = ['rm\\s+-rf\\s+/', '>\\s*/dev/sd', 'dd\\s+if=', 'chmod\\s+777', 'chown\\s+[^:]+:', 'wget\\s+http.*\\|\\s*bash', 'curl\\s+http.*\\|\\s*bash'];

class ApprovalManager {
  constructor(log, getSettings) {
    this.log = log;
    this.getSettings = getSettings;
    this._pending = new Map();
    this._broadcast = null;
  }

  setBroadcast(fn) {
    this._broadcast = fn;
  }

  _getRules() {
    const fromSettings = this.getSettings?.()?.ai?.safetyRules;
    return fromSettings || { mode: 'auto', dangerousCommands: DEFAULT_DANGEROUS_COMMANDS, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS };
  }

  async request(toolName, args) {
    const rules = this._getRules();
    const mode = rules.mode || 'auto';
    const dangerous = this._isDangerous(toolName, args, rules);
    this.log.info(`ApprovalManager.request: tool=${toolName} mode=${mode} dangerous=${dangerous} cmd="${args.command || args.input || ''}"`);
    if (mode === 'off') return { approved: true };
    if (mode === 'auto' && !dangerous) {
      return { approved: true };
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId);
        resolve({ approved: false, reason: 'Approval timeout (60s)' });
      }, 60000);
      this._pending.set(requestId, { resolve, timer });
      if (this._broadcast) {
        this._broadcast(requestId, toolName, args);
      }
    });
  }

  resolve(requestId, approved) {
    const entry = this._pending.get(requestId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this._pending.delete(requestId);
    entry.resolve({ approved, reason: approved ? null : 'Rejected by user' });
  }

  getPendingCount() {
    return this._pending.size;
  }

  _isDangerous(toolName, args, rules) {
    const cmd = args.command || args.input || '';
    const dangerous = rules.dangerousCommands || [];
    const patterns = rules.dangerousPatterns || [];
    const parts = cmd.trim().split(/\s+/);
    const base = parts[0]?.toLowerCase();
    if (dangerous.includes(base)) return true;
    for (const p of patterns) {
      if (new RegExp(p).test(cmd)) return true;
    }
    return false;
  }
}

module.exports = { ApprovalManager };
