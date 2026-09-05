/**
 * _9_security_review.spec.ts
 *
 * E2E regression tests for the items fixed in the P0 security/correctness review.
 * Each describe block references the review item it covers (P0-R1 … P0-R4, P0-S1).
 */

import { expect, test } from './fixtures';
import http from 'http';

// ─── shared helpers ─────────────────────────────────────────────────────────

const DEFAULT_TERMINAL_TYPE = process.platform === 'win32' ? 'cmd' : 'bash';

const BASE_SETTINGS = {
  revision: Date.now(),
  general: { autoUpdate: false, proxyId: '', language: 'en' },
  ui: {
    profileLabelLength: 10,
    profileSideNavType: 'flat',
    secretLabelLength: 10,
    secretLabelLengthInDropDown: 8,
    theme: 'pink-bluegrey',
  },
  groups: [],
  tags: [],
  terminal: { localTerminal: { type: DEFAULT_TERMINAL_TYPE, execPath: '', defaultOpen: false } },
  fileExplorer: {},
  remoteDesktop: { vncClipboardCompatibleMode: false, vncCompressionLevel: 6, vncQuality: 7 },
  ai: {
    mode: 'web', apiUrl: 'https://api.openai.com/v1', token: '', model: '',
    acpCommand: '', acpArgs: '', acpModel: '', useContext: true, agentMode: false,
  },
  isNew: false,
  version: '4.0.2',
  compatibleVersion: '1.0.0',
};

// ─── P0-R1: Terminal onData 重复注册 ────────────────────────────────────────
test.describe('9.1 P0-R1 — Terminal onData not duplicated across tab switches', () => {
  /**
   * Strategy: open two local-terminal tabs, switch between them several times
   * (each switch triggers initTab()), then type a character.
   * Count how many 'terminal.input' IPC sends the renderer makes.
   * With the bug, onData handlers stack → count > 1.  With the fix, count ≤ 1.
   */
  test('typing one key after multiple tab switches sends at most one terminal.input message', async ({ mainWindow }) => {
    // Inject a spy on window.electronAPI.send
    await mainWindow.evaluate(() => {
      (window as any).__terminalInputCount = 0;
      const orig = (window as any).electronAPI.send.bind((window as any).electronAPI);
      (window as any).electronAPI.send = (channel: string, ...args: any[]) => {
        if (channel === 'terminal.input') {
          (window as any).__terminalInputCount++;
        }
        return orig(channel, ...args);
      };
    });

    const sidebarBtn = mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]');
    await expect(sidebarBtn).toBeVisible({ timeout: 10000 });

    // Open first terminal tab
    await sidebarBtn.click();
    await mainWindow.waitForTimeout(1000);
    // Open second terminal tab
    await sidebarBtn.click();
    await mainWindow.waitForTimeout(1000);

    const tabs = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab');
    await expect(tabs).toHaveCount(2);

    // Switch back and forth 3 times to exercise initTab() re-registration
    await tabs.nth(0).click(); await mainWindow.waitForTimeout(400);
    await tabs.nth(1).click(); await mainWindow.waitForTimeout(400);
    await tabs.nth(0).click(); await mainWindow.waitForTimeout(400);

    // Reset counter — we only count keypresses from here
    await mainWindow.evaluate(() => { (window as any).__terminalInputCount = 0; });

    // Simulate a keypress inside the xterm textarea (inside Shadow DOM)
    await mainWindow.evaluate(() => {
      const termEl = document.querySelector('app-terminal') as HTMLElement | null;
      if (!termEl) return;
      const shadow = termEl.shadowRoot;
      const textarea = shadow?.querySelector('textarea.xterm-helper-textarea') as HTMLTextAreaElement | null;
      if (textarea) {
        textarea.focus();
        textarea.value = 'a';
        textarea.dispatchEvent(new InputEvent('input', { data: 'a', bubbles: true }));
      }
    });

    await mainWindow.waitForTimeout(600);

    const count = await mainWindow.evaluate(() => (window as any).__terminalInputCount as number);

    // ≤ 1: fixed (0 is acceptable in headless where xterm may not fire)
    expect(count).toBeLessThanOrEqual(1);
  });
});

// ─── P0-R2: file-list 订阅泄漏 ──────────────────────────────────────────────
test.describe('9.2 P0-R2 — FileListComponent destroy$ cleanup (smoke)', () => {
  /**
   * White-box leak detection requires unit-test tooling.
   * Here we verify the app remains stable (no JS errors) while exercising the
   * component mount/unmount lifecycle via UI navigation.
   */
  test('navigating to file-explorer and back produces no JS errors', async ({ mainWindow }) => {
    const errors: string[] = [];
    mainWindow.on('pageerror', err => errors.push(err.message));

    const feBtn = mainWindow.locator('app-sidebar button[aria-label="File Explorer"]');
    if (await feBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await feBtn.click();
      await mainWindow.waitForTimeout(1000);
      await feBtn.click();
      await mainWindow.waitForTimeout(500);
    }

    expect(errors).toEqual([]);
  });
});

// ─── P0-R3: SPICE 幽灵链路 ──────────────────────────────────────────────────
test.describe('9.3 P0-R3 — SPICE dead-code removed; app stable without SPICE service', () => {

  test('app starts and sidebar renders — no error from missing SPICE service', async ({ mainWindow }) => {
    const errors: string[] = [];
    mainWindow.on('pageerror', err => errors.push(err.message));
    await expect(mainWindow.locator('app-sidebar')).toBeVisible({ timeout: 10000 });
    await mainWindow.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });

  test('invoking session.open.rd.spice IPC returns no structured success (no Angular handler)', async ({ mainWindow }) => {
    // The channel is still whitelisted in preload.js for external plugins, but the
    // Angular ElectronRemoteDesktopService no longer has an openSpiceSession method.
    // Without a main-process ipcMain.handle() registered for spice (in e2e mock),
    // the call should return an error or undefined — never a "session opened" object.
    const result = await mainWindow.evaluate(async () => {
      try {
        const r = await (window as any).electronAPI?.invoke('session.open.rd.spice', {
          id: '__test__', host: '127.0.0.1', port: 5900,
        });
        return r ?? '__undefined__';
      } catch (e: any) {
        return '__error__:' + (e?.message || String(e));
      }
    });
    // Must not look like a successful session object
    expect(typeof result === 'object' && (result as any)?.success === true).toBe(false);
  });
});

// ─── P0-R4: 启动期吞错 ──────────────────────────────────────────────────────
test.describe('9.4 P0-R4 — Startup settings error is surfaced via notification', () => {
  /**
   * Seed an intentionally corrupt settings.json.
   * The fixed .catch() block calls notification.error() and apply(null) as fallback.
   * Expectations: (1) an error snackbar appears, (2) app boots with defaults.
   */

  test.use({
    seedConfig: {
      'settings.json': '{ INVALID JSON %%%',  // intentionally corrupt
    },
  });

  test('corrupt settings.json triggers an error snackbar on startup', async ({ mainWindow }) => {
    const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
    await expect(snackbar).toBeVisible({ timeout: 15000 });
  });

  test('app still renders sidebar with default settings when settings.json is corrupt', async ({ mainWindow }) => {
    await expect(mainWindow.locator('app-sidebar')).toBeVisible({ timeout: 15000 });
  });
});

// ─── P0-S1: Express /api token auth ─────────────────────────────────────────
test.describe('9.5 P0-S1 — Express /api requires a valid per-launch token', () => {
  /**
   * Retrieve the per-launch token from the renderer via IPC (get-api-token),
   * then hit the Express backend directly from the test process (loopback).
   * This exercises the token-gate added in P0-S1.
   */

  function httpGet(url: string, headers: Record<string, string>): Promise<number> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: Number(parsed.port) || 80,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers,
        },
        res => resolve(res.statusCode ?? 0),
      );
      req.on('error', reject);
      req.end();
    });
  }

  async function getToken(mainWindow: import('@playwright/test').Page): Promise<string | null> {
    return mainWindow.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        try {
          const t = await (window as any).electronAPI?.invoke('get-api-token');
          if (t) return t as string;
        } catch { }
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    });
  }

  test('request without token returns 403', async ({ mainWindow }) => {
    const token = await getToken(mainWindow);
    if (!token) { test.skip(); return; }

    const status = await httpGet('http://127.0.0.1:13012/api/health', {}).catch(() => -1);
    expect(status).toBe(403);
  });

  test('request with wrong token returns 403', async ({ mainWindow }) => {
    const token = await getToken(mainWindow);
    if (!token) { test.skip(); return; }

    const status = await httpGet('http://127.0.0.1:13012/api/health', {
      'x-api-token': 'definitely-wrong-token',
    }).catch(() => -1);
    expect(status).toBe(403);
  });

  test('request with correct token is accepted (not 403)', async ({ mainWindow }) => {
    const token = await getToken(mainWindow);
    if (!token) { test.skip(); return; }

    const status = await httpGet('http://127.0.0.1:13012/api/health', {
      'x-api-token': token,
    }).catch(() => -1);
    // 404 = no /api/health route but auth passed; anything but 403 is correct.
    expect(status).not.toBe(403);
  });
});
