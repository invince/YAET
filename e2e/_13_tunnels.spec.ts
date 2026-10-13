import {expect, test} from './fixtures';
import {AppPage} from './app.po';

const PASSWORD = 'test-password';

async function openTunnelsMenu(mainWindow: any) {
  await mainWindow.locator('app-sidebar button[aria-label="Tunnels"]').click();
  await expect(mainWindow.locator('app-tunnels-menu .modal-container')).toBeVisible({ timeout: 5000 });
}

function tunnelDialog(mainWindow: any) {
  return mainWindow.locator('.cdk-overlay-container app-tunnel-form');
}

/** Fill a local (-L) adhoc tunnel; leaves the dialog open for Save/cancel. */
async function fillAdhocLocalTunnel(mainWindow: any, name: string, localPort: string) {
  const dialog = tunnelDialog(mainWindow);
  await expect(dialog).toBeVisible({ timeout: 5000 });

  await dialog.locator('[data-testid="tf-name"]').fill(name);
  await dialog.locator('[data-testid="tf-local-port"]').fill(localPort);
  await dialog.locator('[data-testid="tf-remote-host"]').fill('127.0.0.1');
  await dialog.locator('[data-testid="tf-remote-port"]').fill('3306');

  // Assert the values stuck (ngModel write-back can race a re-render).
  await expect(dialog.locator('[data-testid="tf-remote-host"]')).toHaveValue('127.0.0.1');

  // Connection: custom host + login auth
  await dialog.getByText('Custom host', { exact: true }).click();
  await dialog.locator('[data-testid="tf-host"]').fill('127.0.0.1');
  await dialog.locator('[data-testid="tf-port"]').fill('59999');
  await dialog.locator('[data-testid="tf-login"]').fill('user');
  await dialog.locator('[data-testid="tf-password"]').fill('pass');
  await expect(dialog.locator('[data-testid="tf-password"]')).toHaveValue('pass');
  await mainWindow.waitForTimeout(300);
}

test.describe('13. SSH Tunnels', () => {

  test.beforeEach(async ({ mainWindow }) => {
    const app = new AppPage(mainWindow);
    await app.invoke('masterkey.save', PASSWORD);
    await mainWindow.waitForTimeout(500);
  });

  test.describe('tunnel manager', () => {

    test('opens from sidebar and shows the empty state', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);
      await expect(mainWindow.locator('app-tunnels-menu')).toContainText(/No port-forwarding rules/i);
    });

    test('Ctrl+Shift+T toggles the manager', async ({ mainWindow }) => {
      await mainWindow.keyboard.press('Control+Shift+t');
      await expect(mainWindow.locator('app-tunnels-menu .modal-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.keyboard.press('Control+Shift+t');
      await expect(mainWindow.locator('app-tunnels-menu .modal-container')).toHaveCount(0, { timeout: 5000 });
    });

  });

  test.describe('tunnel CRUD in the manager', () => {

    test('add tunnel via dialog, persists across manager reopen', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      await fillAdhocLocalTunnel(mainWindow, 'CrudTunnel', '13306');

      // Live direction hint explains the -L direction with concrete ports
      await expect(tunnelDialog(mainWindow).locator('.tunnel-form-direction'))
        .toContainText(/13306.*→.*127\.0\.0\.1:3306/s);

      await tunnelDialog(mainWindow).getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const row = mainWindow.locator('app-tunnels-menu .tunnel-row');
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('CrudTunnel');

      // Reopen the manager (fresh read from tunnels.json) — still there
      await mainWindow.keyboard.press('Escape');
      await mainWindow.waitForTimeout(300);
      await openTunnelsMenu(mainWindow);
      await expect(mainWindow.locator('app-tunnels-menu .tunnel-row')).toHaveCount(1);
      await expect(mainWindow.locator('app-tunnels-menu .tunnel-row')).toContainText('CrudTunnel');
    });

    test('incomplete form blocks Save', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      const dialog = tunnelDialog(mainWindow);
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // Default new tunnel has no host → connection error → Save disabled
      await expect(dialog.locator('.tunnel-form-error').first()).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    test('remote tunnel offers a public server bind with approval note', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      const dialog = tunnelDialog(mainWindow);
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.locator('[data-testid="tf-type"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /Remote/i }).first().click();
      await mainWindow.waitForTimeout(300);

      // Server bind select appears for remote type, defaulting to loopback
      const bindSelect = dialog.locator('[data-testid="tf-remote-bind"]');
      await expect(bindSelect).toBeVisible();
      await expect(dialog.locator('.tunnel-form-approval-note')).toHaveCount(0);

      await bindSelect.click();
      await mainWindow.locator('mat-option').filter({ hasText: /0\.0\.0\.0/ }).first().click();
      await mainWindow.waitForTimeout(300);

      // Public bind warns that every connection needs approval
      await expect(dialog.locator('.tunnel-form-approval-note')).toBeVisible();

      // Fill the rest and save: public remote tunnel persists with its bind
      await dialog.locator('[data-testid="tf-name"]').fill('PublicRemote');
      await dialog.locator('[data-testid="tf-local-port"]').fill('8080');
      await dialog.locator('[data-testid="tf-remote-port"]').fill('18080');
      await expect(dialog.locator('[data-testid="tf-remote-port"]')).toHaveValue('18080');
      await dialog.getByText('Custom host', { exact: true }).click();
      await dialog.locator('[data-testid="tf-host"]').fill('127.0.0.1');
      await dialog.locator('[data-testid="tf-login"]').fill('user');
      await dialog.locator('[data-testid="tf-password"]').fill('pass');
      await expect(dialog.locator('[data-testid="tf-password"]')).toHaveValue('pass');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const row = mainWindow.locator('app-tunnels-menu .tunnel-row');
      await expect(row).toHaveCount(1);
      await expect(row).toContainText('PublicRemote');
      await expect(row).toContainText('0.0.0.0:18080');
      await expect(row.locator('.tunnel-public')).toBeVisible();
    });

    test('edit tunnel renames it', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      await fillAdhocLocalTunnel(mainWindow, 'RenameMe', '13307');
      await tunnelDialog(mainWindow).getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const row = mainWindow.locator('app-tunnels-menu .tunnel-row');
      await expect(row).toHaveCount(1);
      await row.locator('button[aria-label^="Edit tunnel"]').click();

      const dialog = tunnelDialog(mainWindow);
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.locator('[data-testid="tf-name"]').fill('RenamedOk');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('app-tunnels-menu .tunnel-row')).toContainText('RenamedOk');
    });

    test('delete tunnel removes it', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      await fillAdhocLocalTunnel(mainWindow, 'DeleteMe', '13308');
      await tunnelDialog(mainWindow).getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const row = mainWindow.locator('app-tunnels-menu .tunnel-row');
      await expect(row).toHaveCount(1);
      await row.locator('button[aria-label^="Delete tunnel"]').click();

      // Confirmation dialog
      const confirm = mainWindow.locator('.cdk-overlay-container app-confirmation');
      await expect(confirm).toBeVisible({ timeout: 5000 });
      await confirm.getByRole('button', { name: /Yes|Confirm|OK/i }).click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('app-tunnels-menu .tunnel-row')).toHaveCount(0);
    });

  });

  test.describe('tunnel lifecycle (no real SSH server)', () => {

    test('tunnels.list returns an array over IPC', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      const list = await app.invoke('tunnels.list');
      expect(Array.isArray(list)).toBeTruthy();
    });

    test('tunnels.start rejects unknown tunnels cleanly', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      let message = '';
      try {
        await app.invoke('tunnels.start', { tunnelId: 'nope' });
      } catch (err) {
        message = String(err);
      }
      expect(message).toMatch(/Tunnel not found|No tunnels found/);
    });

    test('starting a tunnel to a dead SSH endpoint surfaces an error in the manager', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      // 127.0.0.1 on a closed port fails fast (ECONNREFUSED), no real sshd needed
      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      await fillAdhocLocalTunnel(mainWindow, 'DeadTunnel', '0');
      await tunnelDialog(mainWindow).getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const row = mainWindow.locator('app-tunnels-menu .tunnel-row');
      await expect(row).toHaveCount(1);
      await row.locator('button[aria-label^="Start tunnel"]').click();

      // SSH connect fails → error status with the reason, no JS crash
      await expect(row.locator('.tunnel-error')).toBeVisible({ timeout: 20000 });
      await expect(row.locator('.tunnel-error')).not.toBeEmpty();
    });

  });

  test.describe('cloud sync integration', () => {

    test('cloud sync offers a Tunnels checkbox', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Setting Sync"]').click();
      await expect(mainWindow.locator('app-cloud-menu')).toBeVisible({ timeout: 5000 });
      await expect(mainWindow.locator('app-cloud-menu')).toContainText(/Tunnels/i);
    });

  });

  test.describe('command palette integration', () => {
    test('palette lists the tunnel toggle item', async ({ mainWindow }) => {
      await openTunnelsMenu(mainWindow);

      await mainWindow.locator('app-tunnels-menu button[aria-label="Add tunnel"]').click();
      await fillAdhocLocalTunnel(mainWindow, 'PaletteTunnel', '13406');
      await tunnelDialog(mainWindow).getByRole('button', { name: 'Save' }).click();
      await mainWindow.waitForTimeout(500);
      await mainWindow.keyboard.press('Escape');
      await mainWindow.waitForTimeout(300);

      await mainWindow.keyboard.press('Control+k');
      const input = mainWindow.locator('.command-palette-input');
      await expect(input).toBeVisible({ timeout: 5000 });

      await input.fill('tunnel');
      await expect(mainWindow.locator('.command-palette-item').filter({ hasText: /Start tunnel/ })).toHaveCount(1);
      await expect(mainWindow.locator('.command-palette-item').filter({ hasText: /Show Tunnels/ })).toHaveCount(1);
    });

  });

});
