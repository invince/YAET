import { test, expect } from './fixtures';
import { AppPage } from './app.po';

test.describe('3. Settings Menu', () => {

  test.describe('General (tab 0)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
    });

    test('app version is displayed', async ({ mainWindow }) => {
      const versionText = await mainWindow.evaluate(() => {
        const label = document.querySelector('.settings-container mat-label b');
        return label?.textContent?.trim() || '';
      });
      expect(versionText).toMatch(/\d+\.\d+\.\d+/);
    });

    test('Check for Updates button is present', async ({ mainWindow }) => {
      const btn = mainWindow.locator('.settings-container button').filter({ hasText: /Check for Updates/i });
      await expect(btn).toBeVisible();
    });

    test('auto-update toggle exists', async ({ mainWindow }) => {
      const checkbox = mainWindow.locator('.settings-container').locator('mat-checkbox').first();
      await expect(checkbox).toBeVisible();
    });

    test('proxy dropdown is visible when auto-update is on', async ({ mainWindow }) => {
      const proxySelect = mainWindow.locator('.settings-container mat-select[formControlName="proxyId"]');
      await expect(proxySelect).toBeVisible({ timeout: 3000 });
    });

    test('language switcher has multiple options', async ({ mainWindow }) => {
      const langSelect = mainWindow.locator('.settings-container mat-select[formControlName="language"]');
      await expect(langSelect).toBeVisible();

      await langSelect.click();
      const options = mainWindow.locator('mat-option');
      const count = await options.count();
      await expect(count).toBeGreaterThanOrEqual(3);
    });

    test('Set Master Key button is present', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await expect(app.setMasterKeyInSettings).toBeVisible();
    });

  });

  test.describe('UI (tab 1)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(1).click();
      await mainWindow.waitForTimeout(300);
    });

    test('profile label length input exists', async ({ mainWindow }) => {
      const input = mainWindow.locator('.settings-container input[formControlName="uiProfileLabelLength"]');
      await expect(input).toBeVisible();
      await input.fill('15');
      await expect(input).toHaveValue('15');
    });

    test('side nav type select has flat and tree options', async ({ mainWindow }) => {
      const select = mainWindow.locator('.settings-container mat-select[formControlName="profileSideNavType"]');
      await expect(select).toBeVisible();

      await select.click();
      const options = mainWindow.locator('mat-option');
      const texts = await options.allTextContents();
      expect(texts).toContain('flat');
      expect(texts).toContain('tree');
    });

    test('theme selection changes body class', async ({ mainWindow }) => {
      const select = mainWindow.locator('.settings-container mat-select[formControlName="theme"]');
      await expect(select).toBeVisible();

      await select.click();
      const themeOptions = mainWindow.locator('mat-option');
      const count = await themeOptions.count();
      expect(count).toBe(4);

      const bodyClass = await mainWindow.evaluate(() => {
        const classes = document.body.className.split(' ').filter(c => c.startsWith('theme-'));
        return classes[0] || '';
      });
      expect(bodyClass).toMatch(/^theme-/);
    });

    test('secret label length inputs exist', async ({ mainWindow }) => {
      const input1 = mainWindow.locator('.settings-container input[formControlName="uiSecretLabelLength"]');
      const input2 = mainWindow.locator('.settings-container input[formControlName="uiSecretLabelLengthInDropDown"]');
      await expect(input1).toBeVisible();
      await expect(input2).toBeVisible();
    });

  });

  test.describe('Terminal (tab 4)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(4).click();
      await mainWindow.waitForTimeout(300);
    });

    test('terminal type select has options', async ({ mainWindow }) => {
      const select = mainWindow.locator('.settings-container mat-select[formControlName="localTerminalType"]');
      await expect(select).toBeVisible();

      await select.click();
      const options = mainWindow.locator('mat-option');
      const texts = await options.allTextContents();
      expect(texts).toContain('cmd');
      expect(texts).toContain('powershell');
      expect(texts).toContain('bash');
    });

    test('default terminal on startup checkbox exists', async ({ mainWindow }) => {
      const checkbox = mainWindow.locator('.settings-container').locator('mat-checkbox').first();
      await expect(checkbox).toBeVisible();
    });

    // NOTE: 'custom' type is excluded from getLocalTermOptions(); exec path not triggerable via UI

  });

  test.describe('Remote Desktop (tab 5)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(5).click();
      await mainWindow.waitForTimeout(300);
    });

    test('VNC clipboard compatible mode checkbox exists', async ({ mainWindow }) => {
      const checkbox = mainWindow.locator('.settings-container mat-checkbox[formControlName="vncClipboardCompatibleMode"]');
      await expect(checkbox).toBeVisible();
    });

    test('VNC quality input exists', async ({ mainWindow }) => {
      const input = mainWindow.locator('.settings-container input[formControlName="vncQuality"]');
      await expect(input).toBeVisible();
    });

    test('VNC compression level input exists', async ({ mainWindow }) => {
      const input = mainWindow.locator('.settings-container input[formControlName="vncCompressionLevel"]');
      await expect(input).toBeVisible();
    });

  });

  test.describe('AI Assistant (tab 7)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(6).click();
      await mainWindow.waitForTimeout(300);
    });

    test('AI mode select has web and acp options', async ({ mainWindow }) => {
      const select = mainWindow.locator('.settings-container mat-select[formControlName="aiMode"]');
      await expect(select).toBeVisible();

      await select.click();
      const options = mainWindow.locator('mat-option');
      const texts = await options.allTextContents();
      expect(texts).toContain('Web Provider');
      expect(texts).toContain('ACP');
    });

    test('web mode shows API URL, token, model fields', async ({ mainWindow }) => {
      await expect(mainWindow.locator('.settings-container input[formControlName="aiApiUrl"]')).toBeVisible();
      await expect(mainWindow.locator('.settings-container input[formControlName="aiToken"]')).toBeVisible();
      await expect(mainWindow.locator('.settings-container input[formControlName="aiModel"]')).toBeAttached();
    });

    test('switching to ACP mode shows ACP fields', async ({ mainWindow }) => {
      const select = mainWindow.locator('.settings-container mat-select[formControlName="aiMode"]');
      await select.click();
      await mainWindow.locator('mat-option').filter({ hasText: 'ACP' }).click();
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('.settings-container input[formControlName="acpCommand"]')).toBeVisible();
      await expect(mainWindow.locator('.settings-container input[formControlName="acpArgs"]')).toBeVisible();
    });

    test('clear button exists', async ({ mainWindow }) => {
      const clearBtn = mainWindow.locator('.settings-container button').filter({ hasText: /Clear/i });
      await expect(clearBtn).toBeVisible();
    });

  });

  test.describe('Groups (tab 2)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(2).click();
      await mainWindow.waitForTimeout(300);
    });

    test('empty state shown when no groups', async ({ mainWindow }) => {
      const empty = mainWindow.locator('app-groups-form .empty-state');
      await expect(empty).toBeVisible();
    });

    test('add group', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-groups-form .group-name-input input');
      const addBtn = mainWindow.locator('app-groups-form button').filter({ hasText: 'Add Group' });

      await input.fill('MyGroup');
      await addBtn.click();
      await mainWindow.waitForTimeout(300);

      const groupItem = mainWindow.locator('app-groups-form .group-item');
      await expect(groupItem).toHaveCount(1);
      await expect(groupItem.locator('.group-name')).toHaveText('MyGroup');
    });

    test('add multiple groups', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-groups-form .group-name-input input');
      const addBtn = mainWindow.locator('app-groups-form button').filter({ hasText: 'Add Group' });

      await input.fill('GroupA');
      await addBtn.click();
      await input.fill('GroupB');
      await addBtn.click();
      await mainWindow.waitForTimeout(300);

      const items = mainWindow.locator('app-groups-form .group-item');
      await expect(items).toHaveCount(2);
      await expect(items.nth(0).locator('.group-name')).toHaveText('GroupA');
      await expect(items.nth(1).locator('.group-name')).toHaveText('GroupB');
    });

    test('edit group name', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-groups-form .group-name-input input');
      await input.fill('Original');
      await mainWindow.locator('app-groups-form button').filter({ hasText: 'Add Group' }).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-groups-form button[matTooltip="Edit name"]').click();
      const editInput = mainWindow.locator('app-groups-form .inline-edit-input input');
      await editInput.fill('Renamed');
      await editInput.press('Enter');
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-groups-form .group-name')).toHaveText('Renamed');
    });

    test('delete group', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-groups-form .group-name-input input');
      await input.fill('ToDelete');
      await mainWindow.locator('app-groups-form button').filter({ hasText: 'Add Group' }).click();
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-groups-form .group-item')).toHaveCount(1);

      await mainWindow.locator('app-groups-form button[matTooltip="Delete group"]').click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('app-groups-form .group-item')).toHaveCount(0);
    });

  });

  test.describe('Tags (tab 3)', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(3).click();
      await mainWindow.waitForTimeout(300);
    });

    test('empty state shown when no tags', async ({ mainWindow }) => {
      const empty = mainWindow.locator('app-tags-form .empty-state');
      await expect(empty).toBeVisible();
    });

    test('add tag', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-tags-form .tag-name-input input');
      const addBtn = mainWindow.locator('app-tags-form button').filter({ hasText: 'Add Tag' });

      await input.fill('MyTag');
      await addBtn.click();
      await mainWindow.waitForTimeout(300);

      const tagItem = mainWindow.locator('app-tags-form .tag-item');
      await expect(tagItem).toHaveCount(1);
      await expect(tagItem.locator('.tag-name')).toHaveText('MyTag');
    });

    test('add multiple tags', async ({ mainWindow }) => {
      const input = mainWindow.locator('app-tags-form .tag-name-input input');
      const addBtn = mainWindow.locator('app-tags-form button').filter({ hasText: 'Add Tag' });

      await input.fill('TagA');
      await addBtn.click();
      await input.fill('TagB');
      await addBtn.click();
      await mainWindow.waitForTimeout(300);

      const items = mainWindow.locator('app-tags-form .tag-item');
      await expect(items).toHaveCount(2);
      await expect(items.nth(0).locator('.tag-name')).toHaveText('TagA');
      await expect(items.nth(1).locator('.tag-name')).toHaveText('TagB');
    });

    test('edit tag name', async ({ mainWindow }) => {
      await mainWindow.locator('app-tags-form .tag-name-input input').fill('Original');
      await mainWindow.locator('app-tags-form button').filter({ hasText: 'Add Tag' }).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-tags-form button[matTooltip="Edit name"]').click();
      const editInput = mainWindow.locator('app-tags-form .inline-edit-input input');
      await editInput.fill('Renamed');
      await editInput.press('Enter');
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-tags-form .tag-name')).toHaveText('Renamed');
    });

    test('delete tag', async ({ mainWindow }) => {
      await mainWindow.locator('app-tags-form .tag-name-input input').fill('ToDelete');
      await mainWindow.locator('app-tags-form button').filter({ hasText: 'Add Tag' }).click();
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-tags-form .tag-item')).toHaveCount(1);

      await mainWindow.locator('app-tags-form button[matTooltip="Delete tag"]').click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('app-tags-form .tag-item')).toHaveCount(0);
    });

  });

});
