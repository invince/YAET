/**
 * _11_ai_settings.spec.ts
 *
 * E2E tests for the new AI settings fields added in the 0904 security review:
 *   - contextMaxLines, useContext, agentMode, crossSessionAccess
 *   - Web mode fields (apiUrl, token, model)
 *   - ACP mode fields (command, args, model)
 *   - Settings persistence via save/reload
 */

import {expect, test} from './fixtures';
import {AppPage} from './app.po';

const PASSWORD = 'test-password';

const DEFAULT_SETTINGS = {
  revision: Date.now(),
  general: {autoUpdate: false, proxyId: '', language: 'en'},
  ui: {
    profileLabelLength: 10,
    profileSideNavType: 'flat',
    secretLabelLength: 10,
    secretLabelLengthInDropDown: 8,
    theme: 'pink-bluegrey',
  },
  groups: [],
  tags: [],
  terminal: {
    localTerminal: {
      type: process.platform === 'win32' ? 'cmd' : 'bash',
      execPath: '',
      defaultOpen: false,
    },
  },
  fileExplorer: {},
  remoteDesktop: {
    vncClipboardCompatibleMode: false,
    vncCompressionLevel: 6,
    vncQuality: 7,
  },
  ai: {
    mode: 'web',
    apiUrl: 'https://api.openai.com/v1',
    token: '',
    model: '',
    acpCommand: '',
    acpArgs: '',
    acpModel: '',
    useContext: true,
    agentMode: false,
    crossSessionAccess: false,
    contextMaxLines: 50,
  },
  isNew: false,
  version: '4.0.2',
  compatibleVersion: '1.0.0',
};

function openAiSettingsTab(mainWindow: any) {
  return mainWindow.locator('.settings-sidebar .sidebar-item').nth(6).click();
}

// ─── 11.1 New AI settings fields exist ───────────────────────────────────────
test.describe('11.1 New AI settings fields', () => {

  test.beforeEach(async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);
  });

  test('context max lines input exists with number type', async ({mainWindow}) => {
    const input = mainWindow.locator(
      '.settings-container input[formControlName="aiContextMaxLines"]'
    );
    await expect(input).toBeVisible();
    expect(await input.getAttribute('type')).toBe('number');
  });

  test('use context checkbox exists', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiUseContext"]'
    );
    await expect(checkbox).toBeVisible();
  });

  test('agent mode checkbox exists', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiAgentMode"]'
    );
    await expect(checkbox).toBeVisible();
  });

  test('cross session access checkbox exists', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiCrossSessionAccess"]'
    );
    await expect(checkbox).toBeVisible();
  });
});

// ─── 11.2 Context max lines validation ───────────────────────────────────────
test.describe('11.2 Context max lines validation', () => {

  test.beforeEach(async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);
  });

  test('context max lines accepts valid number', async ({mainWindow}) => {
    const input = mainWindow.locator(
      '.settings-container input[formControlName="aiContextMaxLines"]'
    );
    await input.fill('100');
    await expect(input).toHaveValue('100');
  });

  test('context max lines has min attribute of 10', async ({mainWindow}) => {
    const input = mainWindow.locator(
      '.settings-container input[formControlName="aiContextMaxLines"]'
    );
    const min = await input.getAttribute('min');
    expect(min).toBe('10');
  });
});

// ─── 11.3 Web mode fields ────────────────────────────────────────────────────
test.describe('11.3 Web mode fields', () => {

  test.beforeEach(async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);
  });

  test('web mode shows API URL, token, and model fields', async ({mainWindow}) => {
    // Default mode is 'web', so these should be visible
    await expect(
      mainWindow.locator('.settings-container input[formControlName="aiApiUrl"]')
    ).toBeVisible();
    await expect(
      mainWindow.locator('.settings-container input[formControlName="aiToken"]')
    ).toBeVisible();
    await expect(
      mainWindow.locator('.settings-container input[formControlName="aiModel"]')
    ).toBeVisible();
  });

  test('API URL field has default value', async ({mainWindow}) => {
    const input = mainWindow.locator(
      '.settings-container input[formControlName="aiApiUrl"]'
    );
    const value = await input.inputValue();
    expect(value).toContain('api.openai.com');
  });
});

// ─── 11.4 ACP mode fields ────────────────────────────────────────────────────
test.describe('11.4 ACP mode fields', () => {

  test.beforeEach(async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);
  });

  test('switching to ACP mode shows command and args fields', async ({mainWindow}) => {
    const modeSelect = mainWindow.locator(
      '.settings-container mat-select[formControlName="aiMode"]'
    );
    await modeSelect.click();
    await mainWindow.locator('mat-option').filter({hasText: 'ACP'}).click();
    await mainWindow.waitForTimeout(300);

    await expect(
      mainWindow.locator('.settings-container input[formControlName="acpCommand"]')
    ).toBeVisible();
    await expect(
      mainWindow.locator('.settings-container input[formControlName="acpArgs"]')
    ).toBeVisible();
  });

  test('switching back to ACP hides web fields', async ({mainWindow}) => {
    const modeSelect = mainWindow.locator(
      '.settings-container mat-select[formControlName="aiMode"]'
    );
    await modeSelect.click();
    await mainWindow.locator('mat-option').filter({hasText: 'ACP'}).click();
    await mainWindow.waitForTimeout(300);

    // Web fields should be hidden
    const apiUrlVisible = await mainWindow
      .locator('.settings-container input[formControlName="aiApiUrl"]')
      .isVisible()
      .catch(() => false);
    expect(apiUrlVisible).toBe(false);
  });
});

// ─── 11.5 Checkbox toggles ──────────────────────────────────────────────────
test.describe('11.5 Checkbox toggles', () => {

  test.beforeEach(async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);
  });

  test('use context checkbox is checked by default', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiUseContext"]'
    );
    const isChecked = await checkbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    expect(isChecked).toBe(true);
  });

  test('agent mode checkbox is unchecked by default', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiAgentMode"]'
    );
    const isChecked = await checkbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    expect(isChecked).toBe(false);
  });

  test('cross session access checkbox is unchecked by default', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiCrossSessionAccess"]'
    );
    const isChecked = await checkbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    expect(isChecked).toBe(false);
  });

  test('clicking agent mode checkbox toggles its state', async ({mainWindow}) => {
    const checkbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiAgentMode"]'
    );
    const before = await checkbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    // Click the inner label/input to trigger Angular Material's change detection
    await checkbox.locator('label').click();
    await mainWindow.waitForTimeout(300);
    const after = await checkbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    expect(after).toBe(!before);
  });
});

// ─── 11.6 Settings persistence ───────────────────────────────────────────────
test.describe('11.6 Settings persistence', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify({
        ...DEFAULT_SETTINGS,
        ai: {
          ...DEFAULT_SETTINGS.ai,
          contextMaxLines: 80,
          useContext: false,
          agentMode: true,
          crossSessionAccess: true,
        },
      }),
    },
  });

  test('seeded AI settings load correctly', async ({mainWindow}) => {
    const result = await mainWindow.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        try {
          const val = await (window as any).electronAPI?.invoke('settings.get');
          if (val) return val;
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    });

    expect(result).not.toBeNull();
    expect(result?.ai?.contextMaxLines).toBe(80);
    expect(result?.ai?.useContext).toBe(false);
    expect(result?.ai?.agentMode).toBe(true);
    expect(result?.ai?.crossSessionAccess).toBe(true);
  });

  test('seeded AI settings reflect in the form', async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(500);

    // Check context max lines
    const input = mainWindow.locator(
      '.settings-container input[formControlName="aiContextMaxLines"]'
    );
    await expect(input).toHaveValue('80');

    // Check agent mode is checked
    const agentCheckbox = mainWindow.locator(
      '.settings-container mat-checkbox[formControlName="aiAgentMode"]'
    );
    const isAgentChecked = await agentCheckbox.evaluate(
      (el) => el.classList.contains('mat-mdc-checkbox-checked')
    );
    expect(isAgentChecked).toBe(true);
  });
});

// ─── 11.7 Clear button ──────────────────────────────────────────────────────
test.describe('11.7 Clear button', () => {

  test('clear button exists in AI settings', async ({mainWindow}) => {
    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(300);

    const clearBtn = mainWindow
      .locator('.settings-container button')
      .filter({hasText: /Clear/i});
    await expect(clearBtn).toBeVisible();
  });
});

// ─── 11.8 AI settings no JS errors ──────────────────────────────────────────
test.describe('11.8 AI settings stability', () => {

  test('navigating to AI settings tab produces no JS errors', async ({mainWindow}) => {
    const errors: string[] = [];
    mainWindow.on('pageerror', err => errors.push(err.message));

    const app = new AppPage(mainWindow);
    await app.guardedButton('Settings').click();
    await expect(app.settingsContainer).toBeVisible({timeout: 5000});
    await openAiSettingsTab(mainWindow);
    await mainWindow.waitForTimeout(500);

    // Switch between modes
    const modeSelect = mainWindow.locator(
      '.settings-container mat-select[formControlName="aiMode"]'
    );
    await modeSelect.click();
    await mainWindow.locator('mat-option').filter({hasText: 'ACP'}).click();
    await mainWindow.waitForTimeout(300);

    await modeSelect.click();
    await mainWindow.locator('mat-option').filter({hasText: 'Web Provider'}).click();
    await mainWindow.waitForTimeout(300);

    expect(errors).toEqual([]);
  });
});
