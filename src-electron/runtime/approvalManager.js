const DEFAULT_DANGEROUS_COMMANDS = ['rm', 'dd', 'shutdown', 'reboot', 'mkfs', 'fdisk', 'format', 'sudo', 'su', 'passwd', 'kill', 'pkill', 'systemctl'];
const DEFAULT_DANGEROUS_PATTERNS = ['rm\\s+-rf\\s+/', '>\\s*/dev/sd', 'dd\\s+if=', 'chmod\\s+777', 'chown\\s+[^:]+:', 'wget\\s+http.*\\|\\s*bash', 'curl\\s+http.*\\|\\s*bash'];

// Leading wrappers that don't change what actually runs (`sudo rm`, `nohup kill`).
const WRAPPER_COMMANDS = new Set(['sudo', 'su', 'env', 'nohup', 'time', 'nice']);

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
    // P0-2: tools that mutate files or open new sessions always need a human
    // look in auto mode — command-text analysis can't cover them (no command
    // string to scan, and session_write inputs arrive fragmented).
    if (/^(terminal_open|.*_(write_file|delete_files|rename_file|copy_files|move_files|create_folder|download_file))$/.test(toolName || '')) return true;

    const raw = args.command || args.input || '';
    // Normalize full-width / non-breaking spaces so `rm　-rf` can't dodge the split.
    const cmd = String(raw).replace(/[\u3000\u00A0]/g, ' ');
    const dangerous = rules.dangerousCommands || [];
    const patterns = rules.dangerousPatterns || [];
    // Split compound shell lines so `echo hi; rm -rf /` or `a && b` are judged
    // per segment, not just by the first word of the whole string.
    const segments = cmd.split(/;|\r?\n|&&|\|\|/);
    for (const seg of segments) {
      const tokens = seg.trim().split(/\s+/).filter(Boolean);
      let i = 0;
      while (i < tokens.length) {
        const base = tokens[i].split('/').pop().toLowerCase();
        if (base === 'sudo' || base === 'su') {
          i++;
          // Skip sudo flags (`-u`, `-E`, ...) and `-u <user>` values.
          while (i < tokens.length && tokens[i].startsWith('-')) {
            const flag = tokens[i].toLowerCase();
            i++;
            if ((flag === '-u' || flag === '--user') && i < tokens.length) i++;
          }
          continue;
        }
        if (WRAPPER_COMMANDS.has(base)) { i++; continue; }
        // Skip `VAR=val` env assignments: `FOO=1 rm ...`.
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) { i++; continue; }
        if (dangerous.includes(base)) return true;
        break;
      }
    }
    for (const p of patterns) {
      try {
        if (new RegExp(p).test(cmd)) return true;
      } catch (_) {
        // P0-4: a bad user-supplied pattern must not crash the loop.
        if (this.log) this.log.warn(`ApprovalManager: ignoring invalid dangerousPattern: ${p}`);
      }
    }
    return false;
  }
}

module.exports = { ApprovalManager };
