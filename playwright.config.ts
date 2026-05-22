import {defineConfig, devices} from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: [
            path.join(__dirname, 'src-electron', 'electronMain.js'),
          ],
        },
      },
      // Increase timeout for Electron app to allow proper shutdown
      timeout: 60000,
    },
  ],
});
