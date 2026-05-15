import { test, expect } from './fixtures';
import { AppPage } from './app.po';

const PASSWORD = 'test-password';

test.describe('8. Cloud Settings', () => {

  test.beforeEach(async ({ mainWindow }) => {
    const app = new AppPage(mainWindow);
    await app.invoke('masterkey.save', PASSWORD);
    await mainWindow.waitForTimeout(500);
  });

  test('open cloud menu from sidebar', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Cloud"]').click();
    await expect(mainWindow.locator('app-cloud-menu .modal-container')).toBeVisible({ timeout: 5000 });
  });

  test('form fields exist', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Cloud"]').click();
    await expect(mainWindow.locator('app-cloud-menu .modal-container')).toBeVisible({ timeout: 5000 });

    await expect(mainWindow.locator('app-cloud-menu input[formControlName="url"]')).toBeVisible();
    await expect(mainWindow.locator('app-cloud-menu mat-select[formControlName="proxyId"]')).toBeVisible();
    await expect(mainWindow.locator('app-cloud-menu mat-radio-group[formControlName="authType"]')).toBeVisible();
    await expect(mainWindow.locator('app-cloud-menu mat-selection-list')).toBeVisible();
  });

  test('upload button disabled when form incomplete', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Cloud"]').click();
    await expect(mainWindow.locator('app-cloud-menu .modal-container')).toBeVisible({ timeout: 5000 });

    const uploadBtn = mainWindow.locator('app-cloud-menu button').filter({ hasText: /Upload/i });
    await expect(uploadBtn).toBeDisabled();
  });

  test('auth type radio buttons exist and toggle fields', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Cloud"]').click();
    await expect(mainWindow.locator('app-cloud-menu .modal-container')).toBeVisible({ timeout: 5000 });

    // Fill URL first so form has less invalid reasons
    await mainWindow.locator('app-cloud-menu input[formControlName="url"]').fill('https://github.com/user/repo.git');

    // Click LOGIN radio by clicking the radio input inside
    const loginRadio = mainWindow.locator('app-cloud-menu mat-radio-group input[type="radio"]').nth(1);
    await loginRadio.click({ force: true });
    await mainWindow.waitForTimeout(500);
    await expect(mainWindow.locator('app-cloud-menu input[formControlName="password"]')).toBeVisible();

    // Click SECRET radio (third radio)
    const secretRadio = mainWindow.locator('app-cloud-menu mat-radio-group input[type="radio"]').nth(2);
    await secretRadio.click({ force: true });
    await mainWindow.waitForTimeout(500);
    await expect(mainWindow.locator('app-cloud-menu mat-select[formControlName="secretId"]')).toBeVisible();
  });

});
