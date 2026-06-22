const { exec } = require('child_process');
const EventEmitter = require('events');

class TerminalRuntimeApi extends EventEmitter {
  async connect(options) { throw new Error('not implemented'); }
  async write(data) { throw new Error('not implemented'); }
  async resize(cols, rows) { throw new Error('not implemented'); }
  async close() { throw new Error('not implemented'); }
  async exec(command) { throw new Error('not implemented'); }
}

class WinRMSession extends TerminalRuntimeApi {
  constructor(log, projectRequire) {
    super();
    this.log = log;
    this._projectRequire = projectRequire;
    this.process = null;
    this._connected = false;
  }

  async connect(options = {}) {
    const pty = this._projectRequire('node-pty');
    const { initPath, initCmd, rows, cols, settings, host, username, password, port } = options;

    let localTermForWinRM = 'powershell.exe';
    if (settings?.terminal?.localTerminal?.type === 'powershell 7') {
      localTermForWinRM = 'pwsh.exe';
    }

    const isWindows = process.platform === 'win32';
    const isDebuggerAttached = typeof v8debug === 'object' ||
                               /--debug|--inspect/.test(process.execArgv.join(' ')) ||
                               (process.env.VSCODE_INSPECTOR_OPTIONS !== undefined) ||
                               (require('inspector').url() !== undefined);

    const useConpty = isWindows && !isDebuggerAttached;

    const ptyProcess = pty.spawn(localTermForWinRM, [], {
      name: 'xterm-color',
      cols: cols || 80,
      rows: rows || 30,
      cwd: process.env.HOME,
      env: process.env,
      useConpty: useConpty,
    });

    let initialized = false;

    ptyProcess.onData((data) => {
      if (!initialized) {
        if (data.includes('Enter-PSSession')) {
          initialized = true;
          this.log.info('WinRM session established');
          this.emit('opened', {});
        }
      } else {
        this.emit('output', { data: data.toString() });
      }
    });

    ptyProcess.on('error', (err) => {
      this.log.error('WinRM terminal error:', err);
      this.emit('error', { error: err.message });
    });

    ptyProcess.on('exit', () => {
      this._connected = false;
      this.process = null;
      this.emit('closed', {});
    });

    const esc = (s) => (s || '').replace(/'/g, "''");
    const portOption = port ? ` -Port ${port}` : '';
    let connectionCommand = [];
    if (password && username) {
      connectionCommand = [
        `$secPassword = ConvertTo-SecureString '${esc(password)}' -AsPlainText -Force`,
        `$cred = New-Object System.Management.Automation.PSCredential('${esc(username)}', $secPassword)`,
        `Enter-PSSession -ComputerName '${esc(host)}' -Credential $cred${portOption}`,
      ];
    } else {
      connectionCommand = [`Enter-PSSession -ComputerName '${esc(host)}'${portOption}`];
    }

    for (const oneCmd of connectionCommand) {
      ptyProcess.write(oneCmd + '\r');
    }

    if (initPath) {
      ptyProcess.write(`cd ${initPath}\r`);
    }
    if (initCmd) {
      ptyProcess.write(`${initCmd}\r`);
    }

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
    const { host, username, password, port } = this._lastOptions || {};
    if (!host) throw new Error('No WinRM config available for exec');

    const portOption = port ? ` -Port ${port}` : '';
    const esc = (s) => (s || '').replace(/'/g, "''");
    const script = [
      `$secPassword = ConvertTo-SecureString '${esc(password)}' -AsPlainText -Force`,
      `$cred = New-Object System.Management.Automation.PSCredential('${esc(username)}', $secPassword)`,
      `Invoke-Command -ComputerName '${esc(host)}'${portOption} -Credential $cred -ScriptBlock { ${command} }`,
    ].join('; ');

    return new Promise((resolve) => {
      const child = exec(
        `powershell.exe -NoProfile -Command "& { ${script} }"`,
        { timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: error ? (error.code || 1) : 0,
          });
        }
      );
    });
  }
}

module.exports = { WinRMSession };
