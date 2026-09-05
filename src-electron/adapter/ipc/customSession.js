const { ipcMain, app } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Tracked child processes: sessionKey → { child, timer }
const activeSessions = new Map();

/**
 * Extract the program name from a shell command string.
 * Handles quoted paths and bare names.
 */
function extractProgramName(command) {
  const trimmed = command.trim();
  if (!trimmed) return null;

  // Handle quoted program path: "C:\Program Files\app.exe" args...
  const quotedMatch = trimmed.match(/^["']([^"']+)["']/);
  if (quotedMatch) return quotedMatch[1];

  // Bare program: first whitespace-delimited token
  const spaceIdx = trimmed.search(/\s/);
  return spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
}

/**
 * Check if a file exists and is executable (X_OK).
 * On Windows, we just check existence (no X_OK concept).
 */
function validateExecutable(programPath) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Windows: just check file exists
      fs.access(programPath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    } else {
      // Unix: check X_OK
      fs.access(programPath, fs.constants.X_OK, (err) => {
        if (!err) return resolve(true);
        // Fallback: check if file exists at all (script with shebang, etc.)
        fs.access(programPath, fs.constants.F_OK, (err2) => {
          resolve(!err2);
        });
      });
    }
  });
}

/**
 * Try to resolve a bare command name to a full path using PATH.
 */
function resolveViaPath(command) {
  const pathDirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of pathDirs) {
    const full = path.join(dir, command);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function killSession(key) {
  const entry = activeSessions.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  activeSessions.delete(key);
  if (entry.child && !entry.child.killed) {
    entry.child.kill('SIGTERM');
    // Force kill after 3s if still alive
    setTimeout(() => {
      if (entry.child && !entry.child.killed) {
        entry.child.kill('SIGKILL');
      }
    }, 3000);
  }
}

function initCustomSessionHandler(log) {

  // Clean up all child processes on app quit
  app.on('will-quit', () => {
    for (const [key] of activeSessions) {
      killSession(key);
    }
  });

  ipcMain.on('session.open.custom', (event, { command }) => {
    if (!command || !command.trim()) {
      log.error('Empty command received');
      return;
    }

    const program = extractProgramName(command);
    if (!program) {
      log.error('Could not parse program from command');
      return;
    }

    // Validate the executable exists
    const isAbsolute = path.isAbsolute(program);
    const validatePromise = isAbsolute
      ? validateExecutable(program)
      : new Promise((resolve) => {
          const resolved = resolveViaPath(program);
          resolve(!!resolved);
        });

    validatePromise.then((valid) => {
      if (!valid) {
        log.error(`Executable not found or not accessible: ${program}`);
        return;
      }

      log.info(`Launching custom command: ${program}`);

      // Use shell: true so the OS shell handles argument parsing correctly.
      // This avoids the fragile hand-written parseCommand() and lets the
      // platform shell (bash/cmd) handle quoting, globbing, etc.
      const child = spawn(command, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        // Detach from parent so SIGTERM propagates to the whole process group
        detached: false,
      });

      const sessionKey = `custom_${Date.now()}_${child.pid}`;
      const timer = setTimeout(() => {
        log.warn(`Custom session ${sessionKey} timed out after ${DEFAULT_TIMEOUT_MS / 1000}s`);
        killSession(sessionKey);
      }, DEFAULT_TIMEOUT_MS);

      activeSessions.set(sessionKey, { child, timer });

      child.stdout.on('data', (data) => {
        log.log(`custom profile Output: ${data.toString()}`);
      });

      child.stderr.on('data', (data) => {
        log.error(`custom profile Error: ${data.toString()}`);
      });

      child.on('error', (error) => {
        log.error(`Error launching custom profile: ${error.message}`);
        killSession(sessionKey);
      });

      child.on('close', (code) => {
        log.info(`Custom session ${sessionKey} exited with code ${code}`);
        killSession(sessionKey);
      });
    });
  });

  ipcMain.on('session.close.custom', (event, { sessionKey } = {}) => {
    if (sessionKey) {
      killSession(sessionKey);
    }
  });
}

module.exports = { initCustomSessionHandler, extractProgramName, validateExecutable, resolveViaPath };
