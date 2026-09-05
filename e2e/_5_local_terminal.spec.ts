import {expect, test} from './fixtures';

const DEFAULT_TERMINAL_TYPE = process.platform === 'win32' ? 'cmd' : 'bash';

const DEFAULT_SETTINGS = {
  revision: Date.now(),
  general: { autoUpdate: true, proxyId: '', language: 'en' },
  ui: { profileLabelLength: 10, profileSideNavType: 'flat', secretLabelLength: 10, secretLabelLengthInDropDown: 8, theme: 'pink-bluegrey' },
  groups: [], tags: [],
  terminal: { localTerminal: { type: DEFAULT_TERMINAL_TYPE, execPath: '', defaultOpen: false } },
  fileExplorer: {},
  remoteDesktop: { vncClipboardCompatibleMode: false, vncCompressionLevel: 6, vncQuality: 7 },
  ai: { mode: 'web', apiUrl: 'https://api.openai.com/v1', token: '', model: '', acpCommand: '', acpArgs: '', acpModel: '', useContext: true, agentMode: false },
  isNew: false, version: '4.0.2', compatibleVersion: '1.0.0',
};

test.describe('5. Local Terminal (UI only)', () => {

  test.describe('sidebar button opens terminal', () => {

    test('clicking Add Local Terminal button opens a tab', async ({ mainWindow }) => {
      const btn = mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]');
      await expect(btn).toBeVisible();

      const tabLabels = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab');
      await expect(tabLabels).toHaveCount(0);

      await btn.click();
      await mainWindow.waitForTimeout(1000);

      await expect(tabLabels).toHaveCount(1);
    });

  });

  test.describe('open terminal at startup', () => {

    test.use({
      seedConfig: {
        'settings.json': JSON.stringify({
          ...DEFAULT_SETTINGS,
          terminal: { localTerminal: { type: DEFAULT_TERMINAL_TYPE, execPath: '', defaultOpen: true } },
        }),
      },
    });

    test('terminal tab opens automatically at startup when setting is enabled', async ({ mainWindow }) => {
      const tabLabels = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab');
      await expect(tabLabels).toHaveCount(1);
    });

  });

  test.describe('switch terminal type', () => {

    test('changing type in settings does not break terminal button', async ({ mainWindow }) => {
      // Open settings → Terminal tab → change type
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();

      // Wait for settings to open and click Terminal tab (nth(4) = tab 4)
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(4).click();
      await mainWindow.waitForTimeout(300);

      // Change terminal type
      const typeSelect = mainWindow.locator('.settings-container mat-select[formControlName="localTerminalType"]');
      await typeSelect.click();
      const targetType = process.platform === 'win32' ? 'powershell' : 'bash';
      await mainWindow.locator('mat-option').filter({ hasText: targetType }).first().click();
      await mainWindow.waitForTimeout(300);

      // Close settings (click Cancel)
      await mainWindow.locator('.settings-actions button').filter({ hasText: 'Cancel' }).click();
      await mainWindow.waitForTimeout(300);

      // Now click local terminal button — should still open a tab
      await mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]').click();
      await mainWindow.waitForTimeout(1000);

      const tabLabels = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab');
      await expect(tabLabels).toHaveCount(1);
    });

  });

});

test.describe('5b. Local Terminal — real PTY smoke', () => {

  test.use({ useRealPty: true });

  test('opens real terminal, sends command, receives output', async ({ mainWindow }) => {
    const btn = mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]');
    await expect(btn).toBeVisible();
    await btn.click();

    // Wait for the xterm terminal to appear
    const xterm = mainWindow.locator('app-terminal .xterm');
    await expect(xterm).toBeVisible({ timeout: 10000 });

    // Wait for shell to be ready
    await mainWindow.waitForTimeout(2000);

    // Focus the terminal and type a unique echo command
    const marker = `yaet-pty-${Date.now()}`;
    await xterm.click();
    await mainWindow.keyboard.type(`echo ${marker}`, { delay: 30 });
    await mainWindow.keyboard.press('Enter');

    // Wait for the command to execute and output to render
    await mainWindow.waitForTimeout(3000);

    // Read xterm screen buffer via evaluate
    const hasMarker = await mainWindow.evaluate((m) => {
      const termEl = document.querySelector('app-terminal .xterm');
      if (!termEl) return false;
      // xterm.js stores screen buffer in the terminal instance
      // Access via the xterm addon or the screen rows
      const rows = termEl.querySelectorAll('.xterm-rows > div');
      for (const row of rows) {
        if (row.textContent?.includes(m)) return true;
      }
      return false;
    }, marker);

    expect(hasMarker).toBeTruthy();
  });

});
