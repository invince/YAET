import {expect, test} from './fixtures';
import {AppPage} from './app.po';

test.describe('14. Known Hosts (A3 host-key verification)', () => {

  test.beforeEach(async ({ mainWindow }) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
    // Known Hosts is the last sidebar entry.
    await mainWindow.locator('.settings-sidebar .sidebar-item').last().click();
    await mainWindow.waitForTimeout(300);
  });

  test('known hosts tab shows title and import button', async ({ mainWindow }) => {
    await expect(mainWindow.locator('app-known-hosts')).toBeVisible();
    const importBtn = mainWindow.locator('app-known-hosts button').filter({ hasText: /Import/i });
    await expect(importBtn).toBeVisible();
  });

  test('empty store shows the empty-state hint', async ({ mainWindow }) => {
    // Fresh e2e profile dir → no known_hosts file → empty state, no rows.
    await expect(mainWindow.locator('app-known-hosts')).toContainText(/No host keys|还没有|Keine Hostschlüssel/i);
    await expect(mainWindow.locator('app-known-hosts mat-icon').filter({ hasText: 'delete' })).toHaveCount(0);
  });

  test('save buttons stay disabled on the known hosts tab', async ({ mainWindow }) => {
    const saveButtons = mainWindow.locator('.settings-actions button').filter({ hasText: /Save/i });
    const count = await saveButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < count; i++) {
      await expect(saveButtons.nth(i)).toBeDisabled();
    }
  });
});
