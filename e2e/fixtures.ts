import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

export type E2EFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
  tempUserData: string;
  seedConfig: Record<string, string> | undefined;
};

export const test = base.extend<E2EFixtures>({
  tempUserData: async ({}, use) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaet-e2e-'));
    await use(dir);
    fs.rmSync(dir, { recursive: true, force: true });
  },

  seedConfig: [undefined, { option: true }],

  electronApp: async ({ tempUserData, seedConfig }, use) => {
    if (seedConfig) {
      const yaetDir = path.join(tempUserData, '.yaet');
      fs.mkdirSync(yaetDir, { recursive: true });
      for (const [file, content] of Object.entries(seedConfig)) {
        fs.writeFileSync(path.join(yaetDir, file), content, 'utf-8');
      }
    }

    const electronApp = await electron.launch({
      args: [path.join(__dirname, '..', 'src-electron', 'electronMain.e2e.js')],
      env: {
        ...process.env,
        NODE_ENV: 'e2e',
        YAET_HOME: tempUserData,
      },
    });
    await use(electronApp);
    await electronApp.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect } from '@playwright/test';
