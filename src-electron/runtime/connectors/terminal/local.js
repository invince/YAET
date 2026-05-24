const pty = require('node-pty');
const { exec } = require('child_process');
const { TerminalRuntimeApi } = require('../../interfaces/terminalRuntimeApi');

class LocalTerminalSession extends TerminalRuntimeApi {
  constructor(log) {
    super();
    this.log = log;
    this.process = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const { terminalExec, rows, cols, cwd } = options;
    const shell = terminalExec || (process.platform === 'win32' ? 'cmd.exe' : 'bash');

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: cwd || process.env.HOME,
      env: process.env,
      useConpty: false,
    });

    ptyProcess.onData((data) => {
      this.emit('output', { data: data.toString() });
    });

    ptyProcess.on('error', (err) => {
      this.log.error('Local terminal error:', err);
      this.emit('error', { error: err.message });
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
      this.process.kill();
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
