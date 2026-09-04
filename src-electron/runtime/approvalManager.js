const DEFAULT_DANGEROUS_COMMANDS = ['rm', 'dd', 'shutdown', 'reboot', 'mkfs', 'fdisk', 'format', 'sudo', 'su', 'passwd', 'kill', 'pkill', 'systemctl'];
const DEFAULT_DANGEROUS_PATTERNS = ['rm\\s+-rf\\s+/', '>\\s*/dev/sd', 'dd\\s+if=', 'chmod\\s+777', 'chown\\s+[^:]+:', 'wget\\s+http.*\\|\\s*bash', 'curl\\s+http.*\\|\\s*bash'];

// Leading wrappers that don't change what actually runs (`sudo rm`, `nohup kill`).
const WRAPPER_COMMANDS = new Set(['sudo', 'su', 'env', 'nohup', 'time', 'nice']);

// P0-4: caps for user-supplied safetyRules. True ReDoS detection is infeasible
// without a native engine (e.g. re2), so over-long / over-many /
// nested-quantifier patterns are discarded with a warning instead.
const MAX_DANGEROUS_PATTERNS = 50;
const MAX_PATTERN_LENGTH = 200;
const MAX_DANGEROUS_COMMANDS = 100;
// Classic catastrophic-backtracking shape: a quantified group that is itself
// quantified — `(a+)+`, `(x*)*`, `(a+|b)+`. Linear groups like `(a|b)+` pass.
const NESTED_QUANTIFIER = /\([^()]*[+*{][^()]*\)[+*{?]/;

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
    const raw = fromSettings || { mode: 'auto', dangerousCommands: DEFAULT_DANGEROUS_COMMANDS, dangerousPatterns: DEFAULT_DANGEROUS_PATTERNS };
    return this._sanitizeRules(raw);
  }

  // Precompile user-supplied patterns once (instead of per command) and drop
  // anything invalid / over-long / over-many / ReDoS-shaped. Dropping is
  // fail-closed for availability (loop keeps running) and fail-open only for
  // that single pattern — never for the whole gate.
  _sanitizeRules(raw) {
    const mode = raw.mode || 'auto';
    const dangerousCommands = Array.isArray(raw.dangerousCommands)
      ? raw.dangerousCommands.filter(c => typeof c === 'string' && c.length > 0).slice(0, MAX_DANGEROUS_COMMANDS)
      : [];
    let patterns = Array.isArray(raw.dangerousPatterns) ? raw.dangerousPatterns : [];
    if (patterns.length > MAX_DANGEROUS_PATTERNS) {
      this.log?.warn?.(`ApprovalManager: too many dangerousPatterns (${patterns.length}), keeping first ${MAX_DANGEROUS_PATTERNS}`);
      patterns = patterns.slice(0, MAX_DANGEROUS_PATTERNS);
    }
    const compiled = [];
    for (const p of patterns) {
      if (typeof p !== 'string' || p.length === 0) continue;
      if (p.length > MAX_PATTERN_LENGTH) {
        this.log?.warn?.(`ApprovalManager: dropping over-long dangerousPattern (${p.length} chars)`);
        continue;
      }
      if (NESTED_QUANTIFIER.test(p)) {
        this.log?.warn?.(`ApprovalManager: dropping nested-quantifier dangerousPattern: ${p}`);
        continue;
      }
      try {
        compiled.push(new RegExp(p));
      } catch (_) {
        this.log?.warn?.(`ApprovalManager: dropping invalid dangerousPattern: ${p}`);
      }
    }
    return { mode, dangerousCommands, dangerousPatterns: patterns, _compiled: compiled };
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
    // Prefer precompiled patterns from _sanitizeRules; fall back to on-the-fly
    // compile (with try/catch) for ad-hoc rules objects.
    let compiled = rules._compiled;
    if (!compiled) {
      compiled = [];
      for (const p of (rules.dangerousPatterns || [])) {
        try {
          compiled.push(new RegExp(p));
        } catch (_) {
          // P0-4: a bad user-supplied pattern must not crash the loop.
          if (this.log) this.log.warn(`ApprovalManager: ignoring invalid dangerousPattern: ${p}`);
        }
      }
    }
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
    for (const re of compiled) {
      if (re.test(cmd)) return true;
    }
    return false;
  }
}

module.exports = { ApprovalManager };
