import { test, expect } from './fixtures';
import path from 'path';
import fs from 'fs';

const DEFAULT_SETTINGS = {
  revision: Date.now(),
  general: { autoUpdate: true, proxyId: '', language: 'en' },
  ui: {
    profileLabelLength: 10,
    profileSideNavType: 'flat',
    secretLabelLength: 10,
    secretLabelLengthInDropDown: 8,
    theme: 'pink-bluegrey',
  },
  groups: [],
  tags: [],
  terminal: { localTerminal: { type: 'cmd', execPath: '', defaultOpen: false } },
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

test.describe('1. Application Startup', () => {

  test.describe('fresh install (no existing config files)', () => {
    test('creates .yaet config directory', async ({ tempUserData, mainWindow }) => {
      const yaetDir = path.join(tempUserData, '.yaet');
      expect(fs.existsSync(yaetDir)).toBe(true);
    });

    test('app renders with sidebar visible', async ({ mainWindow }) => {
      await expect(mainWindow).toHaveTitle(/YetAnotherElectronTerm/i);
      await expect(mainWindow.locator('app-sidebar')).toBeVisible();
    });

    test('Angular app bootstraps successfully', async ({ mainWindow }) => {
      const loaded = await mainWindow.evaluate(() => {
        const el = document.querySelector('app-root');
        if (!el) return { error: 'app-root not found' };
        return { appRootFound: true };
      });
      expect(loaded.appRootFound).toBe(true);
    });

    test('no JS errors on startup', async ({ mainWindow }) => {
      const errors: string[] = [];
      mainWindow.on('pageerror', err => errors.push(err.message));
      await mainWindow.waitForTimeout(2000);
      expect(errors).toEqual([]);
    });
  });

  test.describe('start with existing config files', () => {
    const CUSTOM_LANG = 'zh';

    test.use({
      seedConfig: {
        'settings.json': JSON.stringify({
          ...DEFAULT_SETTINGS,
          general: { autoUpdate: false, proxyId: '', language: CUSTOM_LANG },
        }),
      },
    });

    test('loads saved settings via polling', async ({ mainWindow }) => {
      const result = await mainWindow.evaluate(async () => {
        for (let i = 0; i < 20; i++) {
          try {
            const val = await (window as any).electronAPI?.invoke('settings.get');
            if (val) return val;
          } catch { }
          await new Promise(r => setTimeout(r, 500));
        }
        return null;
      });
      expect(result).not.toBeNull();
      expect(result?.general?.language).toBe(CUSTOM_LANG);
      expect(result?.general?.autoUpdate).toBe(false);
    });
  });

  test.describe('production mode', () => {
    test('loads from dist file (not dev server)', async ({ mainWindow }) => {
      const url = mainWindow.url();
      expect(url).toContain('file://');
    });
  });

  test.describe('toast notifications', () => {
    test.use({
      seedConfig: {
        'settings.json': JSON.stringify({
          ...DEFAULT_SETTINGS,
          compatibleVersion: '10.0.0',
        }),
      },
    });

    test('incompatible version shows info toast at startup', async ({ mainWindow }) => {
      const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10000 });
    });
  });

});
