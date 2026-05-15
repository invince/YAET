import { Page, Locator } from '@playwright/test';

export class AppPage {
  constructor(public readonly page: Page) {}

  //#region Sidebar
  get sidebar(): Locator {
    return this.page.locator('app-sidebar');
  }

  guardedButton(ariaLabel: string): Locator {
    return this.page.locator(`app-sidebar button[aria-label="${ariaLabel}"]`);
  }
  //#endregion

  //#region Snackbar / Toast
  get snackbar(): Locator {
    return this.page.locator('.mat-mdc-snack-bar-container');
  }

  snackbarAction(text: string): Locator {
    return this.snackbar.locator('button').filter({ hasText: text }).first();
  }
  //#endregion

  //#region Settings
  get settingsContainer(): Locator {
    return this.page.locator('.settings-container');
  }

  get setMasterKeyInSettings(): Locator {
    return this.settingsContainer.locator('button').filter({ hasText: /Set Master Key/i });
  }
  //#endregion

  //#region Master Key Dialog
  get masterKeyDialog(): Locator {
    return this.page.locator('app-master-key');
  }

  masterKeyInput(formControl: string): Locator {
    return this.masterKeyDialog.locator(`input[formControlName="${formControl}"]`);
  }

  get masterKeySubmit(): Locator {
    return this.masterKeyDialog.locator('button[type="submit"]');
  }

  get masterKeyAbort(): Locator {
    return this.masterKeyDialog.locator('button').filter({ hasText: 'Abort' }).first();
  }
  //#endregion

  //#region Confirmation Dialog
  get confirmationDialog(): Locator {
    return this.page.locator('app-confirmation');
  }

  confirmButton(text: string = 'OK'): Locator {
    return this.confirmationDialog.locator('button').filter({ hasText: text }).first();
  }

  get confirmationAbort(): Locator {
    return this.confirmationDialog.locator('button').filter({ hasText: 'Abort' }).first();
  }
  //#endregion

  //#region Secrets Menu
  get secretsMenu(): Locator {
    return this.page.locator('app-secrets-menu');
  }

  get secretsMenuContainer(): Locator {
    return this.secretsMenu.locator('.modal-container');
  }

  get secretsAddButton(): Locator {
    return this.secretsMenu.locator('button[aria-label="Add Secret"]');
  }

  get secretsFilterInput(): Locator {
    return this.secretsMenu.locator('.sidenav-filter input');
  }

  get secretsForm(): Locator {
    return this.page.locator('app-secret-form');
  }

  secretInput(formControl: string): Locator {
    return this.secretsForm.locator(`input[formControlName="${formControl}"]`);
  }

  get secretTypeSelect(): Locator {
    return this.secretsForm.locator('mat-select[formControlName="secretType"]');
  }

  get secretKeyTextarea(): Locator {
    return this.secretsForm.locator('textarea[formControlName="key"]');
  }

  get secretsSaveBtn(): Locator {
    return this.secretsForm.locator('.modal-footer button').filter({ hasText: 'Save' });
  }

  get secretsDeleteBtn(): Locator {
    return this.secretsForm.locator('.modal-footer button').filter({ hasText: 'Delete' });
  }

  get secretsCancelBtn(): Locator {
    return this.secretsForm.locator('.modal-footer button').filter({ hasText: 'Cancel' });
  }

  secretListItem(name: string): Locator {
    return this.secretsMenu.locator('.sidenav-content button').filter({ hasText: name });
  }

  async selectSecretType(type: string): Promise<void> {
    await this.secretTypeSelect.click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  get secretsMenuClose(): Locator {
    return this.secretsMenu.locator('.modal-header button[mat-icon-button]').first();
  }
  //#endregion

  //#region IPC
  async invoke(channel: string, data?: unknown): Promise<unknown> {
    return this.page.evaluate(
      ({ channel, data }) => (window as any).electronAPI?.invoke(channel, data),
      { channel, data }
    );
  }

  async send(channel: string, data?: unknown): Promise<void> {
    await this.page.evaluate(
      ({ channel, data }) => (window as any).electronAPI?.send(channel, data),
      { channel, data }
    );
  }
  //#endregion
}
