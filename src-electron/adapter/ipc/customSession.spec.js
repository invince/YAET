/**
 * Unit tests for customSession.js — P0-S8 fix.
 *
 * We mock Electron's ipcMain/app before requiring the module so the pure
 * functions can be tested in a plain Node.js environment.
 */

// ── Mock Electron before requiring the module ──────────────────────────────
const noop = () => {};
const mockIpcMain = { on: noop };
const mockApp = { on: noop };
require.cache[require.resolve('electron')] = {
  exports: { ipcMain: mockIpcMain, app: mockApp },
  loaded: true,
};

const { extractProgramName, validateExecutable, resolveViaPath } = require('./customSession');
const fs = require('fs');

describe('customSession — P0-S8 fix', () => {

  // ── extractProgramName ────────────────────────────────────────────────────

  describe('extractProgramName', () => {
    it('returns null for empty string', () => {
      expect(extractProgramName('')).toBeNull();
      expect(extractProgramName('   ')).toBeNull();
    });

    it('extracts bare command name', () => {
      expect(extractProgramName('ls')).toBe('ls');
      expect(extractProgramName('ls -la')).toBe('ls');
    });

    it('extracts double-quoted path', () => {
      expect(extractProgramName('"C:\\Program Files\\putty.exe" -ssh host')).toBe('C:\\Program Files\\putty.exe');
      expect(extractProgramName('"/usr/bin/my app" --flag')).toBe('/usr/bin/my app');
    });

    it('extracts single-quoted path', () => {
      expect(extractProgramName("'/usr/bin/my app' --flag")).toBe('/usr/bin/my app');
    });

    it('handles extra whitespace', () => {
      expect(extractProgramName('  /usr/bin/ssh   user@host')).toBe('/usr/bin/ssh');
    });

    it('handles Windows-style paths', () => {
      expect(extractProgramName('C:\\Windows\\System32\\cmd.exe /c dir')).toBe('C:\\Windows\\System32\\cmd.exe');
    });
  });

  // ── validateExecutable ────────────────────────────────────────────────────

  describe('validateExecutable', () => {
    it('resolves true for /bin/sh (or bash)', async () => {
      const shell = fs.existsSync('/bin/sh') ? '/bin/sh' : '/bin/bash';
      const result = await validateExecutable(shell);
      expect(result).toBe(true);
    });

    it('resolves false for non-existent path', async () => {
      const result = await validateExecutable('/nonexistent/path/to/binary');
      expect(result).toBe(false);
    });

    it('resolves true for /usr/bin/env (commonly executable)', async () => {
      if (process.platform !== 'win32') {
        const result = await validateExecutable('/usr/bin/env');
        expect(result).toBe(true);
      }
    });
  });

  // ── resolveViaPath ────────────────────────────────────────────────────────

  describe('resolveViaPath', () => {
    it('resolves "sh" or "bash" via PATH', () => {
      const name = fs.existsSync('/bin/sh') ? 'sh' : 'bash';
      const result = resolveViaPath(name);
      expect(result).toBeTruthy();
      expect(result).toMatch(/bin/);
    });

    it('returns null for non-existent command', () => {
      const result = resolveViaPath('__nonexistent_command_12345__');
      expect(result).toBeNull();
    });
  });
});
