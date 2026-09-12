const pty = require('node-pty');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

function resolveMacShell(terminalExec) {
  // Normalize bare names saved by older versions ('bash'/'zsh'/'sh')
  // to absolute paths — packaged apps have a minimal PATH.
  const alias = { bash: '/bin/bash', zsh: '/bin/zsh', sh: '/bin/sh' };
  if (terminalExec) {
    const normalized = alias[terminalExec] || alias[terminalExec.split('/').pop()] || terminalExec;
    try {
      if (fs.existsSync(normalized) && fs.statSync(normalized).isFile()) {
        // Custom absolute path: use as-is but still as login shell for env setup
        return { shell: normalized, args: ['-l'] };
      }
      // Saved path doesn't exist (e.g. stale custom path) — fall through to candidates
    } catch { /* fall through to candidates */ }
  }
  // Prefer user's login shell ($SHELL), then zsh, then bash — absolute paths
  // because packaged Electron apps on macOS have a minimal PATH.
  const candidates = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/usr/bin/zsh',
    '/usr/bin/bash',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        // -l = login shell so profile/rc files load (PATH, etc.)
        return { shell: c, args: ['-l'] };
      }
    } catch { /* try next */ }
  }
  return { shell: '/bin/zsh', args: ['-l'] };
}

class LocalTerminalSession extends TerminalRuntimeApi {
  constructor(log) {
    super();
    this.log = log;
    this.process = null;
    this._connected = false;
    this._closing = false;
    // Defensive: 'error' is special on EventEmitter — emitting it without a
    // listener throws ERR_UNHANDLED_ERROR and crashes the main process.
    // Keep a no-op listener so any future emit('error') can never crash us.
    this.on('error', () => {});
  }

  async connect(options = {}) {
    const { terminalExec, rows, cols, cwd } = options;
    const isMac = process.platform === 'darwin';
    let shell, args;
    if (isMac) {
      ({ shell, args } = resolveMacShell(terminalExec));
    } else {
      shell = terminalExec || (process.platform === 'win32' ? 'cmd.exe' : 'bash');
      args = [];
    }

    const isWindows = process.platform === 'win32';
    const isDebuggerAttached = typeof v8debug === 'object' || 
                               /--debug|--inspect/.test(process.execArgv.join(' ')) || 
                               (process.env.VSCODE_INSPECTOR_OPTIONS !== undefined) ||
                               (require('inspector').url() !== undefined);

    const useConpty = isWindows && !isDebuggerAttached;

    let ptyProcess;
    try {
      ptyProcess = pty.spawn(shell, args, {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: cwd || process.env.HOME || os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
      useConpty: useConpty,
    });
    } catch (err) {
      this.log.error('Local terminal spawn failed:', shell, err);
      const msg = 'Failed to start shell (' + shell + '): ' + (err && err.message ? err.message : String(err));
      this.emit('error', { error: msg });
      throw new Error(msg);
    }

    ptyProcess.onData((data) => {
      this.emit('output', { data: data.toString() });
    });

    ptyProcess.on('error', (err) => {
      const msg = (err && err.message) ? err.message : String(err);
      // Benign race on Linux: after kill()/child exit the pty master read
      // fails with EIO. Not a real error — the 'exit' handler below already
      // emits 'disconnect'. Swallow it instead of crashing.
      if (this._closing || !this._connected || /EIO|closed|hang ?up/i.test(msg)) {
        this._connected = false;
        return;
      }
      this.log.error('Local terminal error:', err);
      this.emit('error', { error: msg });
    });

    ptyProcess.on('exit', (exitCode) => {
      this._connected = false;
      this.process = null;
      this.emit('disconnect', { error: false });
    });

    this.process = ptyProcess;
    this._connected = true;
  }

  async write(data) {
    if (this.process) {
      this.process.write(data);
      return true;
    }
    return false;
  }

  async resize(cols, rows) {
    if (this.process) {
      this.process.resize(cols, rows);
    }
  }

  async close() {
    if (this.process) {
      this._closing = true;
      try { this.process.kill(); } catch { /* ignore — already dead */ }
      this.process = null;
      this._connected = false;
    }
  }

  async exec(command) {
    const shell = process.platform === 'win32' ? { shell: 'cmd.exe' } : {};
    return new Promise((resolve) => {
      const child = exec(command, {
        ...shell,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: error ? (error.code || 1) : 0,
        });
      });
    });
  }
}

module.exports = { LocalTerminalSession };
