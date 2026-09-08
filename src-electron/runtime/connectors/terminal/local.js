const pty = require('node-pty');
const { exec } = require('child_process');
const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

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
    const shell = terminalExec || (process.platform === 'win32' ? 'cmd.exe' : 'bash');

    const isWindows = process.platform === 'win32';
    const isDebuggerAttached = typeof v8debug === 'object' || 
                               /--debug|--inspect/.test(process.execArgv.join(' ')) || 
                               (process.env.VSCODE_INSPECTOR_OPTIONS !== undefined) ||
                               (require('inspector').url() !== undefined);

    const useConpty = isWindows && !isDebuggerAttached;

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: cwd || process.env.HOME,
      env: process.env,
      useConpty: useConpty,
    });

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
