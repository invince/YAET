import { test, expect } from './fixtures';

const THEMES = [
  { value: 'pink-bluegrey', label: /Pink.*Blue/i },
  { value: 'purple-green', label: /Purple.*Green/i },
  { value: 'indigo-pink', label: /Indigo.*Pink/i },
  { value: 'deeppurple-amber', label: /Deep Purple.*Amber/i },
];

test.describe('6. UI/UX', () => {

  test.describe('Tab management', () => {

    test('open multiple tabs and count them', async ({ mainWindow }) => {
      const btn = mainWindow.locator('app-sidebar button[aria-label="Add Local Terminal"]');
      const tabLabels = () => mainWindow.locator('#tab-group-0 .mat-mdc-tab-labels .mat-mdc-tab');

      await btn.click();
      await mainWindow.waitForTimeout(300);
      await btn.click();
      await mainWindow.waitForTimeout(300);
      await btn.click();
      await mainWindow.waitForTimeout(300);

      await expect(tabLabels()).toHaveCount(3);
    });

    test('close a tab via close button', async ({ mainWindow }) => {
      const btn = mainWindow.locator('app-sidebar button[aria-label="Add Local Terminal"]');
      const tabLabels = () => mainWindow.locator('#tab-group-0 .mat-mdc-tab-labels .mat-mdc-tab');

      await btn.click();
      await mainWindow.waitForTimeout(300);
      await btn.click();
      await mainWindow.waitForTimeout(300);
      await expect(tabLabels()).toHaveCount(2);

      // First tab already selected; click its close button
      await mainWindow.locator('#tab-group-0 .tab-label button[aria-label="Remove tab"]').first().click();
      await mainWindow.waitForTimeout(300);
      await expect(tabLabels()).toHaveCount(1);
    });

    test('switch between tabs', async ({ mainWindow }) => {
      const btn = mainWindow.locator('app-sidebar button[aria-label="Add Local Terminal"]');

      await btn.click();
      await mainWindow.waitForTimeout(200);
      await btn.click();
      await mainWindow.waitForTimeout(200);

      // Click second tab (by clicking its label area)
      const secondTab = mainWindow.locator('#tab-group-0 .tab-drag-handle').nth(1);
      await secondTab.click();
      await mainWindow.waitForTimeout(300);

      // The active tab has aria-selected="true"; second tab's aria-selected should be true
      const tabs = mainWindow.locator('#tab-group-0 .mat-mdc-tab');
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    });

  });

  test.describe('Split screen', () => {

    test('enable and disable vertical split', async ({ mainWindow }) => {
      // Open a terminal tab first
      await mainWindow.locator('app-sidebar button[aria-label="Add Local Terminal"]').click();
      await mainWindow.waitForTimeout(300);

      const splitBtn = mainWindow.locator('button[aria-label="Split View 50/50 Vertical"]');
      await splitBtn.click();
      await mainWindow.waitForTimeout(500);

      // Pane 1 tab group should appear
      await expect(mainWindow.locator('#tab-group-1')).toBeVisible();

      // Disable split
      await splitBtn.click();
      await mainWindow.waitForTimeout(500);
      await expect(mainWindow.locator('#tab-group-1')).not.toBeVisible();
    });

    test('enable horizontal split', async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Add Local Terminal"]').click();
      await mainWindow.waitForTimeout(300);

      await mainWindow.locator('button[aria-label="Split View 60/40 Horizontal"]').click();
      await mainWindow.waitForTimeout(500);

      await expect(mainWindow.locator('#tab-group-1')).toBeVisible();
    });

  });

  test.describe('Themes', () => {

    test.beforeEach(async ({ mainWindow }) => {
      await mainWindow.locator('app-sidebar button[aria-label="Settings"]').click();
      await expect(mainWindow.locator('.settings-container')).toBeVisible({ timeout: 5000 });
      await mainWindow.locator('.settings-sidebar .sidebar-item').nth(1).click();
      await mainWindow.waitForTimeout(300);
    });

    for (const theme of THEMES) {
      test(`select theme ${theme.value} in form`, async ({ mainWindow }) => {
        const themeSelect = mainWindow.locator('.settings-container mat-select[formControlName="theme"]');
        await themeSelect.click();
        await mainWindow.locator('mat-option').filter({ hasText: theme.label }).click();
        await mainWindow.waitForTimeout(300);

        // Verify the select shows the new value
        await expect(themeSelect).toContainText(theme.label);
      });
    }

  });

  test.describe('Offline', () => {

    test('no external CDN requests on startup', async ({ mainWindow, electronApp }) => {
      const requests: string[] = [];

      // Intercept all network requests from the renderer
      await mainWindow.route('**', route => {
        const url = route.request().url();
        if (url.startsWith('http')) {
          requests.push(url);
        }
        route.continue();
      });

      // Wait a bit for any late requests
      await mainWindow.waitForTimeout(3000);

      expect(requests).toEqual([]);
    });

  });

});
