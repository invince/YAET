import {expect, test} from './fixtures';
import {AppPage} from './app.po';

const PASSWORD = 'test-password';
const NEW_PASSWORD = 'new-password';

test.describe('2. Master Key & Secrets', () => {

  test.describe('Master Key — basic flow', () => {

    test('guarded button shows snackbar prompting to set master key', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Quick Connect').click();
      await expect(app.snackbar).toBeVisible({ timeout: 5000 });
      await expect(app.snackbar).toContainText(/Master key/i);

      await app.snackbarAction('Set it').click();
      await expect(app.masterKeyDialog).toBeVisible({ timeout: 3000 });
      await expect(app.masterKeyDialog.locator('h1')).toContainText(/Set Master Key/i);
    });

    test('set master key via IPC', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.invoke('masterkey.save', PASSWORD);

      const key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);
    });

    test('delete master key via IPC', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.invoke('masterkey.save', PASSWORD);
      let key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);

      await app.invoke('masterkey.delete');
      key = await app.invoke('masterkey.get');
      expect(key).toBeFalsy();
    });

  });

  test.describe('Master Key — UI set and change', () => {

    test('UI: set master key for first time', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Quick Connect').click();
      await app.snackbarAction('Set it').click();
      await expect(app.masterKeyDialog).toBeVisible({ timeout: 3000 });

      await app.masterKeyInput('newPassword').fill(PASSWORD);
      await app.masterKeyInput('confirmPassword').fill(PASSWORD);
      await app.masterKeySubmit.click();

      await expect(app.masterKeyDialog).not.toBeVisible({ timeout: 3000 });

      const key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);
    });

    test('change master key with correct old password → re-encrypt OK', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.invoke('masterkey.save', PASSWORD);
      let key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);

      await app.guardedButton('Settings').click();
      await expect(app.settingsContainer).toBeVisible({ timeout: 3000 });
      await app.setMasterKeyInSettings.click();

      await expect(app.masterKeyDialog).toBeVisible({ timeout: 3000 });
      await app.masterKeyInput('oldPassword').fill(PASSWORD);
      await app.masterKeyInput('newPassword').fill(NEW_PASSWORD);
      await app.masterKeyInput('confirmPassword').fill(NEW_PASSWORD);
      await app.masterKeySubmit.click();

      await expect(app.masterKeyDialog).not.toBeVisible({ timeout: 3000 });
      await expect(app.confirmationDialog).toBeVisible({ timeout: 5000 });
      await expect(app.confirmationDialog).toContainText(/re-encrypt/i);

      await app.confirmButton('OK').click();
      await expect(app.confirmationDialog).not.toBeVisible({ timeout: 3000 });

      key = await app.invoke('masterkey.get');
      expect(key).toBe(NEW_PASSWORD);
    });

    test('change master key with correct old password → re-encrypt Cancel', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.invoke('masterkey.save', PASSWORD);
      let key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);

      await app.guardedButton('Settings').click();
      await app.setMasterKeyInSettings.click();

      await app.masterKeyInput('oldPassword').fill(PASSWORD);
      await app.masterKeyInput('newPassword').fill(NEW_PASSWORD);
      await app.masterKeyInput('confirmPassword').fill(NEW_PASSWORD);
      await app.masterKeySubmit.click();

      await expect(app.masterKeyDialog).not.toBeVisible({ timeout: 3000 });
      await expect(app.confirmationDialog).toBeVisible({ timeout: 5000 });

      await app.confirmationAbort.click();
      await expect(app.confirmationDialog).not.toBeVisible({ timeout: 3000 });

      // Key is always saved; "Cancel" means skip re-encrypt only
      key = await app.invoke('masterkey.get');
      expect(key).toBe(NEW_PASSWORD);
    });

    test('change master key with wrong old password → force continue', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.invoke('masterkey.save', PASSWORD);
      let key = await app.invoke('masterkey.get');
      expect(key).toBe(PASSWORD);

      await app.guardedButton('Settings').click();
      await app.setMasterKeyInSettings.click();

      await app.masterKeyInput('oldPassword').fill('wrong-password');
      await app.masterKeyInput('newPassword').fill(NEW_PASSWORD);
      await app.masterKeyInput('confirmPassword').fill(NEW_PASSWORD);
      await app.masterKeySubmit.click();

      await expect(app.confirmationDialog).toBeVisible({ timeout: 5000 });

      await app.confirmButton('Force Continue').click();
      await expect(app.masterKeyDialog).not.toBeVisible({ timeout: 3000 });

      key = await app.invoke('masterkey.get');
      expect(key).toBe(NEW_PASSWORD);
    });

  });

  test.describe('Master Key — status update', () => {

    test('guarded buttons work after master key is set', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.snackbar).toBeVisible({ timeout: 5000 });

      await app.invoke('masterkey.save', PASSWORD);
      await mainWindow.waitForTimeout(1000);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });
    });

  });

  test.describe('Secrets CRUD', () => {

    test.beforeEach(async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);
      await app.invoke('masterkey.save', PASSWORD);
      await mainWindow.waitForTimeout(500);
    });

    test('add Password Only secret', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });
      await app.secretsAddButton.click();

      await app.secretInput('name').fill('MyPassword');
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();

      await expect(app.secretListItem('MyPassword')).toBeVisible({ timeout: 3000 });
    });

    test('add Login + Password secret', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });
      await app.secretsAddButton.click();

      await app.secretInput('name').fill('MyLogin');
      await app.secretInput('login').fill('user1');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();

      await expect(app.secretListItem('MyLogin')).toBeVisible({ timeout: 3000 });
    });

    test('add SSH Key secret', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });
      await app.secretsAddButton.click();

      await app.secretInput('name').fill('MySSHKey');
      await app.selectSecretType('SSH_KEY');
      await app.secretInput('login').fill('sshuser');
      await app.secretKeyTextarea.fill('-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----');
      await app.secretInput('passphrase').fill('keyphrase123');
      await app.secretsSaveBtn.click();

      await expect(app.secretListItem('MySSHKey')).toBeVisible({ timeout: 3000 });
    });

    test('duplicate secret name shows error', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });
      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('DupTest');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('DupTest')).toBeVisible({ timeout: 3000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('DupTest');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await expect(app.secretsSaveBtn).toBeDisabled();
    });

    test('switch between secrets without modification shows no errors', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('ItemA');
      await app.secretInput('password').fill('passA');
      await app.secretInput('confirmPassword').fill('passA');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('ItemA')).toBeVisible({ timeout: 3000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('ItemB');
      await app.secretInput('password').fill('passB');
      await app.secretInput('confirmPassword').fill('passB');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('ItemB')).toBeVisible({ timeout: 3000 });

      const assertNoErrors = async () => {
        const hasError = await mainWindow.evaluate(() => {
          const form = document.querySelector('app-secret-form');
          if (!form) return true;
          return form.querySelectorAll('mat-error').length > 0;
        });
        expect(hasError).toBe(false);
      };

      // Switch A → B → A without any edits
      await app.secretListItem('ItemA').click();
      await mainWindow.waitForTimeout(300);
      expect(await app.secretInput('name').inputValue()).toBe('ItemA');
      await assertNoErrors();

      await app.secretListItem('ItemB').click();
      await mainWindow.waitForTimeout(300);
      expect(await app.secretInput('name').inputValue()).toBe('ItemB');
      await assertNoErrors();

      await app.secretListItem('ItemA').click();
      await mainWindow.waitForTimeout(300);
      expect(await app.secretInput('name').inputValue()).toBe('ItemA');
      await assertNoErrors();
    });

    test('edit secret rename', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('OldName');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('OldName')).toBeVisible({ timeout: 3000 });

      await app.secretListItem('OldName').click();
      await app.secretInput('name').fill('NewName');
      await app.secretsSaveBtn.click();

      await expect(app.secretListItem('NewName')).toBeVisible({ timeout: 3000 });
    });

    test('edit secret: rename to existing name shows duplicate error', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('NameA');
      await app.secretInput('password').fill('passA');
      await app.secretInput('confirmPassword').fill('passA');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('NameA')).toBeVisible({ timeout: 3000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('NameB');
      await app.secretInput('password').fill('passB');
      await app.secretInput('confirmPassword').fill('passB');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('NameB')).toBeVisible({ timeout: 3000 });

      await app.secretListItem('NameB').click();
      await mainWindow.waitForTimeout(300);

      await app.secretInput('name').fill('Tmp');
      await expect(app.secretsSaveBtn).toBeEnabled();

      await app.secretInput('name').fill('NameA');
      await expect(app.secretsSaveBtn).toBeDisabled();
    });

    test('saved secret fields persist after reopen', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.secretInput('name').fill('Persist');
      await app.secretInput('login').fill('persist-user');
      await app.secretInput('password').fill('persist-pass');
      await app.secretInput('confirmPassword').fill('persist-pass');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('Persist')).toBeVisible({ timeout: 3000 });

      await app.secretListItem('Persist').click();
      await mainWindow.waitForTimeout(300);

      expect(await app.secretInput('name').inputValue()).toBe('Persist');
      expect(await app.secretInput('login').inputValue()).toBe('persist-user');
    });

    test('edit secret: change type preserves appropriate fields', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.secretInput('name').fill('TypeTest');
      await app.secretInput('login').fill('testuser');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('TypeTest')).toBeVisible({ timeout: 3000 });

      await app.secretListItem('TypeTest').click();
      await mainWindow.waitForTimeout(300);

      await expect(app.secretInput('login')).toBeVisible();
      await expect(app.secretInput('password')).toBeVisible();

      await app.selectSecretType('PASSWORD_ONLY');
      await mainWindow.waitForTimeout(300);
      expect(await app.secretInput('login').count()).toBe(0);
      await expect(app.secretInput('password')).toBeVisible();

      await app.selectSecretType('SSH_KEY');
      await mainWindow.waitForTimeout(300);
      expect(await app.secretInput('password').count()).toBe(0);
      await expect(app.secretInput('login')).toBeVisible();
      await expect(app.secretKeyTextarea).toBeVisible();
      await expect(app.secretInput('passphrase')).toBeVisible();
    });

    test('icons displayed correctly in secrets list', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      // Add PASSWORD_ONLY → icon should be 'password'
      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('POSecret');
      await app.secretInput('password').fill('pass');
      await app.secretInput('confirmPassword').fill('pass');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('POSecret')).toBeVisible({ timeout: 3000 });

      // Add LOGIN_PASSWORD → icon should be 'face'
      await app.secretsAddButton.click();
      await app.selectSecretType('LOGIN_PASSWORD');
      await app.secretInput('name').fill('LSecret');
      await app.secretInput('login').fill('u');
      await app.secretInput('password').fill('pass');
      await app.secretInput('confirmPassword').fill('pass');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('LSecret')).toBeVisible({ timeout: 3000 });

      // Add SSH_KEY → icon should be 'key'
      await app.secretsAddButton.click();
      await app.selectSecretType('SSH_KEY');
      await app.secretInput('name').fill('KSecret');
      await app.secretInput('login').fill('u');
      await app.secretKeyTextarea.fill('key content');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('KSecret')).toBeVisible({ timeout: 3000 });

      // Verify each secret's icon in the list
      const iconTexts = await mainWindow.evaluate(() => {
        const items = document.querySelectorAll('app-secrets-menu .sidenav-content button');
        return Array.from(items).map(btn => btn.querySelector('mat-icon')?.textContent?.trim());
      });
      expect(iconTexts).toContain('password');
      expect(iconTexts).toContain('face');
      expect(iconTexts).toContain('key');
    });

    test('delete secret', async ({ mainWindow }) => {
      const app = new AppPage(mainWindow);

      await app.guardedButton('Secrets').click();
      await expect(app.secretsMenuContainer).toBeVisible({ timeout: 5000 });

      await app.secretsAddButton.click();
      await app.selectSecretType('PASSWORD_ONLY');
      await app.secretInput('name').fill('ToDelete');
      await app.secretInput('password').fill('secret123');
      await app.secretInput('confirmPassword').fill('secret123');
      await app.secretsSaveBtn.click();
      await expect(app.secretListItem('ToDelete')).toBeVisible({ timeout: 3000 });

      await app.secretListItem('ToDelete').click();
      await mainWindow.waitForTimeout(500);
      await app.secretsDeleteBtn.click();
      await expect(app.confirmationDialog).toBeVisible({ timeout: 5000 });
      await app.confirmButton('OK').click();

      await expect(app.secretListItem('ToDelete')).not.toBeVisible();
    });

  });

});
