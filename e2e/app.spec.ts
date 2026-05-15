import { test, expect } from './fixtures';
import { AppPage } from './app.po';

test.describe('YAET App', () => {
  let app: AppPage;

  test.beforeEach(async ({ mainWindow }) => {
    app = new AppPage(mainWindow);
  });

  test('app launches and sidebar is visible', async ({ mainWindow }) => {
    await expect(mainWindow).toHaveTitle(/YetAnotherElectronTerm/i);
    await expect(app.sidebar).toBeVisible();
  });

  test('electronAPI is exposed via preload', async ({ mainWindow }) => {
    const hasApi = await mainWindow.evaluate(() => {
      return typeof (window as any).electronAPI?.invoke === 'function'
        && typeof (window as any).electronAPI?.send === 'function'
        && typeof (window as any).electronAPI?.on === 'function';
    });
    expect(hasApi).toBe(true);
  });

  test('platform is reported correctly', async ({ mainWindow }) => {
    const platform = await mainWindow.evaluate(() => (window as any).electronAPI?.platform);
    expect(['win32', 'darwin', 'linux']).toContain(platform);
  });

  test('IPC invoke does not reject', async ({ mainWindow }) => {
    const result = await mainWindow.evaluate(async () => {
      try {
        return await (window as any).electronAPI?.invoke('settings.get');
      } catch (e) {
        return { __error__: (e as Error).message };
      }
    });
    if (result && (result as any).__error__) {
      throw new Error((result as any).__error__);
    }
  });
});
