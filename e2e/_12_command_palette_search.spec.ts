import {expect, test} from './fixtures';

test.describe('12. Command Palette & Terminal Search', () => {

  test.describe('command palette', () => {

    test('Ctrl+K opens the palette and Escape closes it', async ({ mainWindow }) => {
      const palette = mainWindow.locator('.command-palette');
      await expect(palette).toHaveCount(0);

      await mainWindow.keyboard.press('Control+k');
      await expect(palette).toBeVisible({ timeout: 5000 });

      await mainWindow.keyboard.press('Escape');
      await expect(palette).toHaveCount(0, { timeout: 5000 });
    });

    test('Ctrl+K filters actions and Enter runs the selected one', async ({ mainWindow }) => {
      await mainWindow.keyboard.press('Control+k');

      const input = mainWindow.locator('.command-palette-input');
      await expect(input).toBeVisible({ timeout: 5000 });

      await input.fill('settings');
      const items = mainWindow.locator('.command-palette-item');
      await expect(items).toHaveCount(1);
      await expect(items.first()).toContainText('Show Settings');

      await mainWindow.keyboard.press('Enter');
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
    });

    test('Ctrl+K lists open tabs and switch activates the selected tab', async ({ mainWindow }) => {
      // Two local terminals; the palette must expose both in the "Open Tabs"
      // group and activate the one that is picked.
      const localTerminalBtn = mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]');
      await localTerminalBtn.click();
      await mainWindow.waitForTimeout(800);
      await localTerminalBtn.click();
      await mainWindow.waitForTimeout(800);

      const tabs = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab');
      await expect(tabs).toHaveCount(2);

      // Select the first tab so the palette has to move the selection away
      await tabs.nth(0).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.keyboard.press('Control+k');
      const input = mainWindow.locator('.command-palette-input');
      await expect(input).toBeVisible({ timeout: 5000 });

      // The second tab is renamed <name>_1 by TabService to stay unique
      await input.fill('_1');
      const items = mainWindow.locator('.command-palette-item');
      await expect(items).toHaveCount(1);

      await mainWindow.keyboard.press('Enter');
      await mainWindow.waitForTimeout(500);

      const selectedTabs = mainWindow.locator('.mat-mdc-tab-labels .mat-mdc-tab.mdc-tab--active');
      await expect(selectedTabs).toHaveCount(1);
      await expect(selectedTabs).toContainText('_1');
    });

    test('palette shows a message when nothing matches', async ({ mainWindow }) => {
      await mainWindow.keyboard.press('Control+k');
      const input = mainWindow.locator('.command-palette-input');
      await expect(input).toBeVisible({ timeout: 5000 });

      await input.fill('zzz-no-such-command-zzz');
      await expect(mainWindow.locator('.command-palette-empty')).toBeVisible();
      await expect(mainWindow.locator('.command-palette-item')).toHaveCount(0);
    });

  });

  test.describe('terminal search', () => {

    test('Ctrl+Shift+F opens the search bar, reports no results and closes on Escape', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]').click();
      await mainWindow.waitForTimeout(1000);

      await expect(mainWindow.locator('app-terminal .xterm')).toBeVisible({ timeout: 10000 });

      await mainWindow.keyboard.press('Control+Shift+f');
      const search = mainWindow.locator('app-terminal').locator('.terminal-search');
      await expect(search).toBeVisible({ timeout: 5000 });

      // Unknown term → the counter reports "no results"
      await mainWindow.locator('app-terminal').locator('.terminal-search-input').fill('zzz-no-match-zzz');
      await expect(search.locator('.terminal-search-count')).toHaveText('no results');

      // Option toggles light up
      const caseToggle = search.locator('.terminal-search-button').filter({ hasText: 'Aa' });
      await expect(caseToggle).not.toHaveClass(/active/);
      await caseToggle.click();
      await expect(caseToggle).toHaveClass(/active/);

      await mainWindow.keyboard.press('Escape');
      await expect(search).toHaveCount(0, { timeout: 5000 });
    });

  });

  test.describe('terminal search — real PTY', () => {

    test.use({ useRealPty: true });

    test('search finds text echoed by the real shell', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Local Terminal"]').click();

      const xterm = mainWindow.locator('app-terminal .xterm');
      await expect(xterm).toBeVisible({ timeout: 10000 });
      await mainWindow.waitForTimeout(2000);

      const marker = `yaet-search-${Date.now()}`;
      await xterm.click();
      await mainWindow.keyboard.type(`echo ${marker}`, { delay: 20 });
      await mainWindow.keyboard.press('Enter');
      await mainWindow.waitForTimeout(3000);

      await mainWindow.keyboard.press('Control+Shift+f');
      const search = mainWindow.locator('app-terminal').locator('.terminal-search');
      await expect(search).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-terminal').locator('.terminal-search-input').fill(marker);

      // The echoed command line and its output both contain the marker
      const count = search.locator('.terminal-search-count');
      await expect(count).toHaveText(/^\s*[12]\/2\s*$/, { timeout: 5000 });

      // The first match is decorated and selected
      const selections = await mainWindow.evaluate(() => {
        const termEl = document.querySelector('app-terminal')?.shadowRoot?.querySelector('.xterm');
        return termEl?.querySelectorAll('.xterm-find-result-decoration, .xterm-find-active-result-decoration').length ?? 0;
      });
      expect(selections).toBeGreaterThan(0);
    });

  });

});
