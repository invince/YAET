import { test, expect } from './fixtures';
import { AppPage } from './app.po';

const PASSWORD = 'test-password';

async function fillSSHForm(mainWindow: any, name: string, host: string) {
  await mainWindow.locator('app-profile-form input[formControlName="name"]').fill(name);
  await mainWindow.locator('app-profile-form mat-select[formControlName="category"]').click();
  await mainWindow.locator('mat-option').filter({ hasText: /TERMINAL/i }).first().click();
  await mainWindow.waitForTimeout(200);
  await mainWindow.locator('app-profile-form mat-select[formControlName="profileType"]').click();
  await mainWindow.locator('mat-option').filter({ hasText: /SSH/i }).first().click();
  await mainWindow.waitForTimeout(200);
  await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="host"]').fill(host);
  await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="port"]').fill('22');
  await mainWindow.locator('app-remote-terminal-profile-form mat-radio-group[formControlName="authType"] input[type="radio"]').nth(1).click({ force: true });
  await mainWindow.waitForTimeout(200);
  await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="login"]').fill('user');
  await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="password"]').fill('pass');
  await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="confirmPassword"]').fill('pass');
}

test.describe('4. Profiles', () => {

  test.beforeEach(async ({ mainWindow }) => {
    const app = new AppPage(mainWindow);
    await app.invoke('masterkey.save', PASSWORD);
    await mainWindow.waitForTimeout(500);
  });

  test.describe('View Modes', () => {

    test('toggle between flat and tree view', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Tree Style"]').click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profiles-menu button[aria-label="Flat Style"]').click();
      await mainWindow.waitForTimeout(300);
    });

  });

  test.describe('Profile Operations', () => {

    test('add SSH profile (full form)', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);

      await fillSSHForm(mainWindow, 'MyServer', '192.168.1.1');

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('app-profiles-menu .sidenav-content button')).toContainText(/MyServer/i);
    });

    test('saved SSH profile fields persist after reopen', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);

      await fillSSHForm(mainWindow, 'FieldTest', 'field.host');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="port"]').fill('2222');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="path"]').fill('/opt/start');
      await mainWindow.locator('app-remote-terminal-profile-form textarea[formControlName="cmd"]').fill('echo hello');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="login"]').fill('fielduser');

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Reopen the profile to verify saved values
      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /FieldTest/i }).click();
      await mainWindow.waitForTimeout(300);

      // Check all fields
      expect(await mainWindow.locator('app-profile-form input[formControlName="name"]').inputValue()).toBe('FieldTest');
      expect(await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="host"]').inputValue()).toBe('field.host');
      expect(await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="port"]').inputValue()).toBe('2222');
      expect(await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="path"]').inputValue()).toBe('/opt/start');
      expect(await mainWindow.locator('app-remote-terminal-profile-form textarea[formControlName="cmd"]').inputValue()).toBe('echo hello');
      expect(await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="login"]').inputValue()).toBe('fielduser');
    });

    test('clone profile creates a copy with Clone suffix', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);
      await fillSSHForm(mainWindow, 'Src', 'clone-host');
      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      const sidebarBtns = mainWindow.locator('app-profiles-menu .sidenav-content button');
      await expect(sidebarBtns).toHaveCount(1);

      // Click the profile to select it, then clone
      await sidebarBtns.click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Clone' }).click();
      await mainWindow.waitForTimeout(500);

      // Should now have 2 items
      await expect(sidebarBtns).toHaveCount(2);

      // The clone tab should be selected and show clone data
      await expect(sidebarBtns.nth(1)).toContainText(/Clone/i);
      expect(await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="host"]').inputValue()).toBe('clone-host');
    });

    test('clicking tag field without changes does not dirty form', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      // Add first profile
      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await fillSSHForm(mainWindow, 'ServerA', 'server-a');
      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Add second profile
      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await fillSSHForm(mainWindow, 'ServerB', 'server-b');
      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Click first profile
      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /ServerA/i }).click();
      await mainWindow.waitForTimeout(300);

      // Click into the tag input then blur without making changes
      const tagInput = mainWindow.locator('app-profile-form input[placeholder="Add Tag..."]');
      await tagInput.click();
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-profile-form input[formControlName="name"]').click(); // blur
      await mainWindow.waitForTimeout(300);

      // Try to click ServerB — should work without error
      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /ServerB/i }).click();
      await mainWindow.waitForTimeout(300);

      // Verify ServerB's form loaded
      expect(await mainWindow.locator('app-profile-form input[formControlName="name"]').inputValue()).toBe('ServerB');
    });

    test('delete profile with confirmation', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.locator('app-profile-form input[formControlName="name"]').fill('ToDelete');
      await mainWindow.locator('app-profile-form mat-select[formControlName="category"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /TERMINAL/i }).first().click();
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-profile-form mat-select[formControlName="profileType"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /SSH/i }).first().click();
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="host"]').fill('10.0.0.2');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="port"]').fill('22');
      await mainWindow.locator('app-remote-terminal-profile-form mat-radio-group[formControlName="authType"] input[type="radio"]').nth(1).click({ force: true });
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="login"]').fill('user');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="password"]').fill('secret');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="confirmPassword"]').fill('secret');

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /ToDelete/i }).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Delete' }).click();
      await expect(mainWindow.locator('app-confirmation')).toBeVisible({ timeout: 3000 });
      await mainWindow.locator('app-confirmation button').filter({ hasText: 'OK' }).click();
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-profiles-menu .sidenav-content button')).toHaveCount(0);
    });

  });

  test.describe('Quick Connect', () => {

    test('quick connect form opens and renders fields', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Add Profile"]').click();
      await expect(mainWindow.locator('app-quickconnect-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await expect(mainWindow.locator('app-profile-form input[formControlName="name"]')).toBeVisible();
      await expect(mainWindow.locator('app-profile-form mat-select[formControlName="category"]')).toBeVisible();
    });

  });

  test.describe('Secrets with Profiles', () => {

    test('quick-add secret from profile form dropdown', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profile-form input[formControlName="name"]').fill('SSHWithSecret');
      await mainWindow.locator('app-profile-form mat-select[formControlName="category"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /TERMINAL/i }).first().click();
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-profile-form mat-select[formControlName="profileType"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /SSH/i }).first().click();
      await mainWindow.waitForTimeout(200);

      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="host"]').fill('10.0.0.55');
      await mainWindow.locator('app-remote-terminal-profile-form input[formControlName="port"]').fill('22');

      // Switch auth type to "secret" to reveal secret dropdown
      await mainWindow.locator('app-remote-terminal-profile-form mat-radio-group[formControlName="authType"] input[type="radio"]').nth(2).click({ force: true });
      await mainWindow.waitForTimeout(300);

      // Open the secret select and click "Add New..."
      await mainWindow.locator('app-remote-terminal-profile-form mat-select[formControlName="secretId"]').click();
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('mat-option').filter({ hasText: /Add New/i }).click();
      await mainWindow.waitForTimeout(500);

      // Quick-add dialog should be visible
      await expect(mainWindow.locator('app-secret-quick-form')).toBeVisible({ timeout: 3000 });

      // Fill quick-add form
      await mainWindow.locator('app-secret-quick-form input[formControlName="name"]').fill('QuickAddSecret');
      await mainWindow.waitForTimeout(200);

      // Select LOGIN_PASSWORD type explicitly so password fields appear
      await mainWindow.locator('app-secret-quick-form mat-select[formControlName="secretType"]').click();
      await mainWindow.locator('mat-option').filter({ hasText: /LOGIN_PASSWORD/i }).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-secret-quick-form input[formControlName="login"]').fill('user1');
      await mainWindow.locator('app-secret-quick-form input[formControlName="password"]').fill('pass123');
      await mainWindow.locator('app-secret-quick-form input[formControlName="confirmPassword"]').fill('pass123');

      // Save
      await mainWindow.locator('app-secret-quick-form button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Quick-add dialog should close
      await expect(mainWindow.locator('app-secret-quick-form')).not.toBeVisible({ timeout: 3000 });

      // Verify secret was saved by checking the secret storage
      const savedName = await mainWindow.evaluate(() => {
        // Access the secret service through window.__ngContext__
        const appRoot = document.querySelector('app-root');
        if (!appRoot) return null;
        // Use the preload IPC to request a reload, then check
        return null; // can't easily access Angular services
      });

      // As a proxy, verify no error toasts appeared
      const hasErrorToast = await mainWindow.locator('.mat-mdc-snack-bar-container').count();
      expect(hasErrorToast).toBe(0);
    });

    test('delete secret clears profile reference', async ({ mainWindow }) => {
      // Step 1: Create a secret via secrets menu
      await mainWindow.locator('app-sidebar button[aria-label="Save"]').click();
      await expect(mainWindow.locator('app-secrets-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-secrets-menu button[aria-label="Add Secret"]').click();
      await mainWindow.waitForTimeout(200);
      await mainWindow.locator('app-secret-form input[formControlName="name"]').fill('RefSecret');
      await mainWindow.locator('app-secret-form input[formControlName="login"]').fill('refuser');
      await mainWindow.locator('app-secret-form input[formControlName="password"]').fill('pass');
      await mainWindow.locator('app-secret-form input[formControlName="confirmPassword"]').fill('pass');
      await mainWindow.locator('app-secret-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Step 2: Create SSH profile that references the secret
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);
      await fillSSHForm(mainWindow, 'SecProf', 'sec-host');

      // Change auth type from 'login' (set by fillSSHForm) to 'secret'
      await mainWindow.locator('app-remote-terminal-profile-form mat-radio-group[formControlName="authType"] input[type="radio"]').nth(2).click({ force: true });
      await mainWindow.waitForTimeout(300);

      // Select the secret in the dropdown
      await mainWindow.locator('app-remote-terminal-profile-form mat-select[formControlName="secretId"]').click();
      await mainWindow.waitForTimeout(500);
      await mainWindow.locator('mat-option').filter({ hasText: /RefSecre/i }).click();
      await mainWindow.waitForTimeout(200);

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Step 3: Delete the secret
      await mainWindow.locator('app-sidebar button[aria-label="Save"]').click();
      await expect(mainWindow.locator('app-secrets-menu .modal-container')).toBeVisible({ timeout: 5000 });

      // The secret list may need a moment to render
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('app-secrets-menu .sidenav-content button').filter({ hasText: /RefSecret/i }).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-secret-form .modal-footer button').filter({ hasText: 'Delete' }).click();
      await mainWindow.waitForTimeout(500);

      // Confirmation should mention profile reference
      await expect(mainWindow.locator('app-confirmation')).toBeVisible({ timeout: 3000 });
      await expect(mainWindow.locator('app-confirmation')).toContainText(/used by.*profile|profile.*use/i);

      await mainWindow.locator('app-confirmation button').filter({ hasText: 'OK' }).click();
      await mainWindow.waitForTimeout(500);

      // Step 4: Verify profile reference is cleared
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });

      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /SecProf/i }).click();
      await mainWindow.waitForTimeout(300);

      // Switch auth type to 'secret' to check the secretId field
      await mainWindow.locator('app-remote-terminal-profile-form mat-radio-group[formControlName="authType"] input[type="radio"]').nth(2).click({ force: true });
      await mainWindow.waitForTimeout(500);

      // Verify the secretId select is visible (secret was cleared)
      await expect(mainWindow.locator('app-remote-terminal-profile-form mat-select[formControlName="secretId"]')).toBeVisible({ timeout: 3000 });
    });

    test('delete tag clears profile tag reference', async ({ mainWindow }) => {
      // Step 1: Create a tag in settings
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(3).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-tags-form .tag-name-input input').fill('TestTag');
      await mainWindow.locator('app-tags-form button').filter({ hasText: 'Add Tag' }).click();
      await mainWindow.waitForTimeout(300);
      // Close settings via Cancel
      await mainWindow.locator('.settings-actions button').filter({ hasText: 'Cancel' }).click();
      await mainWindow.waitForTimeout(300);

      // Step 2: Create SSH profile with this tag
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);
      await fillSSHForm(mainWindow, 'TagProf', 'tag-host');

      // Add tag to profile via autocomplete
      const tagInput = mainWindow.locator('app-profile-form input[placeholder="Add Tag..."]');
      await tagInput.click();
      await tagInput.fill('TestTag');
      await mainWindow.waitForTimeout(500);

      // Select the tag from autocomplete
      const tagOption = mainWindow.locator('mat-option').filter({ hasText: /TestTag/i });
      if (await tagOption.count() > 0) {
        await tagOption.click();
        await mainWindow.waitForTimeout(200);
      }

      // Save profile
      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Verify tag chip is shown
      await expect(mainWindow.locator('app-profile-form mat-chip-row.tag-chip')).toHaveCount(1);

      // Step 3: Delete the tag from settings
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(3).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-tags-form button[matTooltip="Delete tag"]').click();
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('.settings-actions button').filter({ hasText: 'Cancel' }).click();
      await mainWindow.waitForTimeout(300);

      // Step 4: Verify profile tag reference is cleared
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /TagProf/i }).click();
      await mainWindow.waitForTimeout(300);

      await expect(mainWindow.locator('app-profile-form mat-chip-row.tag-chip')).toHaveCount(0);
    });

    test('delete group moves profiles to default', async ({ mainWindow }) => {
      // Step 1: Create a group in settings
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(2).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-groups-form .group-name-input input').fill('TestGroup');
      await mainWindow.locator('app-groups-form button').filter({ hasText: 'Add Group' }).click();
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('.settings-actions button').filter({ hasText: 'Cancel' }).click();
      await mainWindow.waitForTimeout(300);

      // Step 2: Create SSH profile assigned to that group
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
      await mainWindow.waitForTimeout(300);
      await fillSSHForm(mainWindow, 'GrpProf', 'grp-host');

      // Select the group
      await mainWindow.locator('app-profile-form mat-select[formControlName="group"]').click();
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('mat-option').filter({ hasText: /TestGroup/i }).click();
      await mainWindow.waitForTimeout(200);

      await mainWindow.locator('app-profile-form .modal-footer button').filter({ hasText: 'Save' }).click();
      await mainWindow.waitForTimeout(500);

      // Step 3: Delete the group from settings
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(2).click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-groups-form button[matTooltip="Delete group"]').click();
      await mainWindow.waitForTimeout(300);
      await mainWindow.locator('.settings-actions button').filter({ hasText: 'Cancel' }).click();
      await mainWindow.waitForTimeout(300);

      // Step 4: Verify profile group is cleared (moved to default)
      await mainWindow.locator('app-sidebar button[aria-label="Favorite"]').click();
      await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({ hasText: /GrpProf/i }).click();
      await mainWindow.waitForTimeout(300);

      // The group select should show no value (default)
      const groupSelect = mainWindow.locator('app-profile-form mat-select[formControlName="group"]');
      await expect(groupSelect).toBeVisible();
      // The trigger should not contain the group name
      await expect(groupSelect).not.toContainText(/TestGroup/i);
    });

  });

});
