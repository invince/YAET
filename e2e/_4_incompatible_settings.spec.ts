import {expect, test} from './fixtures';

const DEFAULT_TERMINAL_TYPE = process.platform === 'win32' ? 'cmd' : 'bash';

const HIGH_VERSION = '100.0.0';
const MASTER_KEY = 'e2e-test-key';

const SAMPLE_PROFILES = {
  revision: Date.now(),
  compatibleVersion: HIGH_VERSION,
  version: HIGH_VERSION,
  profiles: [],
};

const SAMPLE_SECRETS = {
  revision: Date.now(),
  compatibleVersion: HIGH_VERSION,
  version: HIGH_VERSION,
  secrets: [],
};

const SAMPLE_CLOUD = {
  revision: Date.now(),
  compatibleVersion: HIGH_VERSION,
  version: HIGH_VERSION,
};

function encrypt(data: unknown): string {
  // Use same algorithm as master-key.service.ts: CryptoJS.AES.encrypt(JSON.stringify(obj), key)
  const CryptoJS = require('crypto-js');
  return CryptoJS.AES.encrypt(JSON.stringify(data), MASTER_KEY).toString();
}

test.describe('Incompatible Settings Warning', () => {

  test.describe('Settings (non-encrypted)', () => {

    test.use({
      seedConfig: {
        'settings.json': JSON.stringify({
          revision: Date.now(),
          general: { autoUpdate: true, proxyId: '', language: 'en' },
          ui: { profileLabelLength: 10, profileSideNavType: 'flat', secretLabelLength: 10, secretLabelLengthInDropDown: 8, theme: 'pink-bluegrey' },
          groups: [],
          tags: [],
          terminal: { localTerminal: { type: DEFAULT_TERMINAL_TYPE, execPath: '', defaultOpen: false } },
          fileExplorer: {},
          remoteDesktop: { vncClipboardCompatibleMode: false, vncCompressionLevel: 6, vncQuality: 7 },
          ai: { mode: 'web', apiUrl: 'https://api.openai.com/v1', token: '', model: '', acpCommand: '', acpArgs: '', acpModel: '', useContext: true, agentMode: false },
          isNew: false,
          version: HIGH_VERSION,
          compatibleVersion: HIGH_VERSION,
        }),
      },
    });

    test('shows warning toast at startup', async ({ mainWindow }) => {
      const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10000 });
      await expect(snackbar).toContainText(/not compatible/i);
    });

  });

  test.describe('Profiles, Secrets, Cloud (encrypted)', () => {

    test.use({
      seedConfig: {
        'settings.json': JSON.stringify({
          revision: Date.now(),
          general: { autoUpdate: true, proxyId: '', language: 'en' },
          ui: { profileLabelLength: 10, profileSideNavType: 'flat', secretLabelLength: 10, secretLabelLengthInDropDown: 8, theme: 'pink-bluegrey' },
          groups: [], tags: [],
          terminal: { localTerminal: { type: DEFAULT_TERMINAL_TYPE, execPath: '', defaultOpen: false } },
          fileExplorer: {},
          remoteDesktop: { vncClipboardCompatibleMode: false, vncCompressionLevel: 6, vncQuality: 7 },
          ai: { mode: 'web', apiUrl: 'https://api.openai.com/v1', token: '', model: '', acpCommand: '', acpArgs: '', acpModel: '', useContext: true, agentMode: false },
          isNew: false, version: '4.0.2', compatibleVersion: '1.0.0',
        }),
        'profiles.json': encrypt(SAMPLE_PROFILES),
        'secrets.json': encrypt(SAMPLE_SECRETS),
        'cloud.json': encrypt(SAMPLE_CLOUD),
      },
    });

    test.beforeEach(async ({ mainWindow }) => {
      await mainWindow.evaluate(async (key) => {
        await (window as any).electronAPI?.invoke('masterkey.save', key);
      }, MASTER_KEY);
      await mainWindow.waitForTimeout(500);
    });

    async function triggerReload(mainWindow: any, channel: string) {
      await mainWindow.evaluate((ch: string) => {
        (window as any).electronAPI?.send(ch, {});
      }, channel);
      await mainWindow.waitForTimeout(1000);
    }

    test('profiles incompatible shows warning', async ({ mainWindow }) => {
      // Profiles are tried to decrypt at startup (no key yet, fails silently)
      // After setting the key, trigger reload to re-process
      await triggerReload(mainWindow, 'profiles.reload');
      const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10000 });
      await expect(snackbar).toContainText(/not compatible/i);
    });

    test('secrets incompatible shows warning', async ({ mainWindow }) => {
      await triggerReload(mainWindow, 'secrets.reload');
      const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10000 });
      await expect(snackbar).toContainText(/not compatible/i);
    });

    test('cloud incompatible shows warning', async ({ mainWindow }) => {
      await triggerReload(mainWindow, 'cloud.reload');
      const snackbar = mainWindow.locator('.mat-mdc-snack-bar-container');
      await expect(snackbar).toBeVisible({ timeout: 10000 });
      await expect(snackbar).toContainText(/not compatible/i);
    });

  });

});
