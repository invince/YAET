import {expect, test} from './fixtures';
import {AppPage} from './app.po';

const PASSWORD = 'test-password';

async function openProfiles(mainWindow: any) {
  await mainWindow.locator('app-sidebar button[aria-label="Profiles"]').click();
  await expect(mainWindow.locator('app-profiles-menu .modal-container')).toBeVisible({timeout: 5000});
}

async function addProfile(mainWindow: any) {
  await mainWindow.locator('app-profiles-menu button[aria-label="Add Profile"]').click();
  await expect(mainWindow.locator('app-profile-form input[formControlName="name"]')).toHaveValue('', {timeout: 5000});
}

async function selectOption(mainWindow: any, formControl: string, text: RegExp) {
  await mainWindow.locator(`app-profile-form mat-select[formControlName="${formControl}"]`).click();
  await mainWindow.locator('mat-option').filter({hasText: text}).first().click();
  await mainWindow.waitForTimeout(250);
}

async function selectAuth(mainWindow: any, formSelector: string, index: number) {
  await mainWindow.locator(`${formSelector} app-auth-form mat-radio-group[formControlName="authType"] input[type="radio"]`)
    .nth(index)
    .click({force: true});
  await mainWindow.waitForTimeout(150);
}

async function fillRdp(mainWindow: any, name: string, host: string) {
  await mainWindow.locator('app-profile-form input[formControlName="name"]').fill(name);
  await selectOption(mainWindow, 'category', /REMOTE DESKTOP/i);
  await selectOption(mainWindow, 'profileType', /RDP/i);
  await expect(mainWindow.locator('app-rdp-profile-form')).toBeVisible({timeout: 5000});
  await mainWindow.locator('app-rdp-profile-form input[formControlName="host"]').fill(host);
}

test.describe('Profile form refactor', () => {
  test.beforeEach(async ({mainWindow}) => {
    await new AppPage(mainWindow).invoke('masterkey.save', PASSWORD);
    await mainWindow.waitForTimeout(500);
  });

  test('RDP requires host and credentials unless N/A is selected', async ({mainWindow}) => {
    await openProfiles(mainWindow);
    await addProfile(mainWindow);
    await mainWindow.locator('app-profile-form input[formControlName="name"]').fill('RdpValidation');
    await selectOption(mainWindow, 'category', /REMOTE DESKTOP/i);
    await selectOption(mainWindow, 'profileType', /RDP/i);
    await expect(mainWindow.locator('app-rdp-profile-form')).toBeVisible({timeout: 5000});

    const save = mainWindow.locator('app-profile-form .modal-footer button').filter({hasText: 'Save'});
    const connect = mainWindow.locator('app-profile-form .modal-footer button').filter({hasText: 'Connect'});
    const emptyHost = mainWindow.locator('app-rdp-profile-form input[formControlName="host"]');
    await emptyHost.focus();
    await emptyHost.blur();
    await mainWindow.waitForTimeout(300);

    await expect(save).toBeDisabled();
    await expect(connect).toBeDisabled();
    await expect(mainWindow.locator('app-rdp-profile-form mat-error')).toContainText(/required/i);

    await mainWindow.locator('app-rdp-profile-form input[formControlName="host"]').fill('rdp.example.com');
    await mainWindow.waitForTimeout(300);

    await expect(save).toBeDisabled();
    await expect(connect).toBeDisabled();
    const emptyLogin = mainWindow.locator('app-auth-form input[formControlName="login"]');
    await emptyLogin.focus();
    await emptyLogin.blur();
    await expect(mainWindow.locator('app-auth-form mat-error')).toContainText(/required/i);

    await mainWindow.locator('app-auth-form input[formControlName="login"]').fill('user');
    await mainWindow.locator('app-auth-form input[formControlName="password"]').fill('pass');
    await mainWindow.waitForTimeout(300);
    await expect(save).toBeEnabled();
    await expect(connect).toBeEnabled();

    await selectAuth(mainWindow, 'app-rdp-profile-form', 0);
    await mainWindow.waitForTimeout(300);
    await expect(save).toBeEnabled();
    await expect(connect).toBeEnabled();
    await expect(mainWindow.locator('app-auth-form input[formControlName="password"]')).toHaveCount(0);
  });

  test('reverting an edit makes Save disabled again', async ({mainWindow}) => {
    await openProfiles(mainWindow);
    await addProfile(mainWindow);
    await fillRdp(mainWindow, 'RdpRevert', 'rdp.revert.example.com');
    await selectAuth(mainWindow, 'app-rdp-profile-form', 0);

    const save = mainWindow.locator('app-profile-form .modal-footer button').filter({hasText: 'Save'});
    await expect(save).toBeEnabled();
    await save.click();
    await mainWindow.waitForTimeout(500);

    await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({hasText: /RdpRevert/i}).click();
    await mainWindow.waitForTimeout(300);

    await expect(save).toBeDisabled();
    const host = mainWindow.locator('app-rdp-profile-form input[formControlName="host"]');
    await host.fill('changed.example.com');
    await mainWindow.waitForTimeout(300);
    await expect(save).toBeEnabled();

    await host.fill('rdp.revert.example.com');
    await mainWindow.waitForTimeout(300);
    await expect(save).toBeDisabled();
  });

  test('switching connection type replaces the plugin form control', async ({mainWindow}) => {
    await openProfiles(mainWindow);
    await addProfile(mainWindow);
    await fillRdp(mainWindow, 'RdpToVnc', 'rdp.switch.example.com');
    await selectAuth(mainWindow, 'app-rdp-profile-form', 0);

    await selectOption(mainWindow, 'profileType', /VNC/i);
    await expect(mainWindow.locator('app-rdp-profile-form')).toHaveCount(0);
    await expect(mainWindow.locator('app-vnc-profile-form')).toBeVisible({timeout: 5000});

    await mainWindow.locator('app-vnc-profile-form input[formControlName="host"]').fill('vnc.switch.example.com');
    await selectAuth(mainWindow, 'app-vnc-profile-form', 0);

    const save = mainWindow.locator('app-profile-form .modal-footer button').filter({hasText: 'Save'});
    await expect(save).toBeEnabled();
    await save.click();
    await mainWindow.waitForTimeout(500);

    await mainWindow.locator('app-profiles-menu .sidenav-content button').filter({hasText: /RdpToVnc/i}).click();
    await mainWindow.waitForTimeout(300);
    expect(await mainWindow.locator('app-vnc-profile-form input[formControlName="host"]').inputValue())
      .toBe('vnc.switch.example.com');
  });
});
