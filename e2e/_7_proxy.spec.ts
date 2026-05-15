import { test, expect } from './fixtures';
import { AppPage } from './app.po';

const PASSWORD = 'test-password';

test.describe('7. Proxy Management', () => {

  test.beforeEach(async ({ mainWindow }) => {
    const app = new AppPage(mainWindow);
    await app.invoke('masterkey.save', PASSWORD);
    await mainWindow.waitForTimeout(500);
  });

  test('open proxy menu from sidebar', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Proxy"]').click();
    await expect(mainWindow.locator('app-proxy-menu .modal-container')).toBeVisible({ timeout: 5000 });
  });

  test('add proxy', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Proxy"]').click();
    await expect(mainWindow.locator('app-proxy-menu .modal-container')).toBeVisible({ timeout: 5000 });

    await mainWindow.locator('app-proxy-menu button[aria-label="Add Proxy"]').click();
    await mainWindow.locator('app-proxy-form input[formControlName="name"]').fill('MyProxy');
    await mainWindow.locator('app-proxy-form input[formControlName="host"]').fill('proxy.example.com');
    await mainWindow.locator('app-proxy-form input[formControlName="port"]').fill('8080');

    const saveBtn = mainWindow.locator('app-proxy-form .modal-footer button').filter({ hasText: 'Save' });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await mainWindow.waitForTimeout(300);

    const proxyItem = mainWindow.locator('app-proxy-menu .sidenav-content button');
    await expect(proxyItem).toContainText(/MyProxy/i);
  });

  test('edit proxy name', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Proxy"]').click();
    await expect(mainWindow.locator('app-proxy-menu .modal-container')).toBeVisible({ timeout: 5000 });

    await mainWindow.locator('app-proxy-menu button[aria-label="Add Proxy"]').click();
    await mainWindow.locator('app-proxy-form input[formControlName="name"]').fill('OldProxy');
    await mainWindow.locator('app-proxy-form input[formControlName="host"]').fill('old.example.com');
    await mainWindow.locator('app-proxy-form input[formControlName="port"]').fill('3128');
    await mainWindow.locator('app-proxy-form .modal-footer button').filter({ hasText: 'Save' }).click();
    await mainWindow.waitForTimeout(300);

    await mainWindow.locator('app-proxy-menu .sidenav-content button').filter({ hasText: /OldProxy/i }).click();
    await mainWindow.waitForTimeout(300);
    await mainWindow.locator('app-proxy-form input[formControlName="name"]').fill('RenamedProxy');
    await mainWindow.locator('app-proxy-form .modal-footer button').filter({ hasText: 'Save' }).click();
    await mainWindow.waitForTimeout(300);

    await expect(mainWindow.locator('app-proxy-menu .sidenav-content button')).toContainText(/RenamedProxy/i);
  });

  test('delete proxy with confirmation', async ({ mainWindow }) => {
    await mainWindow.locator('app-sidebar button[aria-label="Proxy"]').click();
    await expect(mainWindow.locator('app-proxy-menu .modal-container')).toBeVisible({ timeout: 5000 });

    await mainWindow.locator('app-proxy-menu button[aria-label="Add Proxy"]').click();
    await mainWindow.locator('app-proxy-form input[formControlName="name"]').fill('ToDelete');
    await mainWindow.locator('app-proxy-form input[formControlName="host"]').fill('delete.me');
    await mainWindow.locator('app-proxy-form input[formControlName="port"]').fill('9999');
    await mainWindow.locator('app-proxy-form .modal-footer button').filter({ hasText: 'Save' }).click();
    await mainWindow.waitForTimeout(300);

    await mainWindow.locator('app-proxy-menu .sidenav-content button').filter({ hasText: /ToDelete/i }).click();
    await mainWindow.waitForTimeout(300);

    await mainWindow.locator('app-proxy-form .modal-footer button').filter({ hasText: 'Delete' }).click();
    await expect(mainWindow.locator('app-confirmation')).toBeVisible({ timeout: 3000 });
    await mainWindow.locator('app-confirmation button').filter({ hasText: 'OK' }).click();
    await mainWindow.waitForTimeout(300);

    await expect(mainWindow.locator('app-proxy-menu .sidenav-content button')).toHaveCount(0);
  });

});
