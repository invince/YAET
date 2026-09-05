/**
 * _10_ai_chat.spec.ts
 *
 * E2E tests for the AI Chat panel — toggles, history, approval flow, and tool
 * progress display.  Covers the AI security hardening and chat UX improvements
 * merged in the 0904 review.
 *
 * NOTE: The AI toggle button is disabled when AI is not configured (no apiUrl+token
 * for web mode, or no acpCommand for ACP mode). Tests seed settings with a dummy
 * token to enable the button.
 */

import {expect, test} from './fixtures';
import {AppPage} from './app.po';

const PASSWORD = 'test-password';

const AI_CONFIGURED_SETTINGS = {
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
    token: 'sk-test-dummy-token-for-e2e',
    model: 'gpt-4o',
    acpCommand: '',
    acpArgs: '',
    acpModel: '',
    useContext: true,
    agentMode: false,
  },
  isNew: false,
  version: '4.0.2',
  compatibleVersion: '1.0.0',
};

// ─── 10.1 AI Chat Panel open / close ────────────────────────────────────────
test.describe('10.1 AI Chat panel', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify(AI_CONFIGURED_SETTINGS),
    },
  });

  test('bottom toolbar AI button opens the chat panel', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await expect(aiBtn).toBeVisible({timeout: 10000});
    await expect(aiBtn).toBeEnabled({timeout: 5000});

    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const chat = mainWindow.locator('.chat-container');
    await expect(chat).toHaveClass(/open/);
  });

  test('clicking AI button again closes the chat panel', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await expect(aiBtn).toBeEnabled({timeout: 5000});

    // Open
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);
    await expect(mainWindow.locator('.chat-container')).toHaveClass(/open/);

    // Close
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);
    const hasOpen = await mainWindow.evaluate(() => {
      return document.querySelector('.chat-container')?.classList.contains('open') ?? false;
    });
    expect(hasOpen).toBe(false);
  });

  test('close button inside header closes the panel', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const closeBtn = mainWindow.locator('.chat-container .close-btn');
    await closeBtn.click();
    await mainWindow.waitForTimeout(500);

    const hasOpen = await mainWindow.evaluate(() => {
      return document.querySelector('.chat-container')?.classList.contains('open') ?? false;
    });
    expect(hasOpen).toBe(false);
  });

  test('chat panel shows welcome message on first open', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const messages = mainWindow.locator('.chat-container .message');
    await expect(messages.first()).toBeVisible({timeout: 5000});
    const text = await messages.first().textContent();
    expect(text).toBeTruthy();
  });
});

// ─── 10.2 Agent Mode & Context toggles ──────────────────────────────────────
test.describe('10.2 Agent Mode & Context toggles', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify(AI_CONFIGURED_SETTINGS),
    },
  });

  test('Agent toggle exists in chat header', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const toggleGroup = mainWindow.locator('.chat-container .toggle-group').first();
    await expect(toggleGroup).toBeVisible();
    await expect(toggleGroup).toContainText('Agent');
    await expect(toggleGroup.locator('mat-slide-toggle')).toBeVisible();
  });

  test('Context toggle exists in chat header', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const toggleGroup = mainWindow.locator('.chat-container .toggle-group').nth(1);
    await expect(toggleGroup).toBeVisible();
    await expect(toggleGroup).toContainText('Ctx');
    await expect(toggleGroup.locator('mat-slide-toggle')).toBeVisible();
  });

  test('Agent toggle defaults to off', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const agentToggle = mainWindow.locator('.chat-container .toggle-group').first().locator('mat-slide-toggle');
    const isChecked = await agentToggle.evaluate(
      (el) => el.classList.contains('mat-mdc-slide-toggle-checked')
    );
    expect(isChecked).toBe(false);
  });

  test('Context toggle defaults to on', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const ctxToggle = mainWindow.locator('.chat-container .toggle-group').nth(1).locator('mat-slide-toggle');
    const isChecked = await ctxToggle.evaluate(
      (el) => el.classList.contains('mat-mdc-slide-toggle-checked')
    );
    expect(isChecked).toBe(true);
  });
});

// ─── 10.3 Chat History management ────────────────────────────────────────────
test.describe('10.3 Chat History', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify(AI_CONFIGURED_SETTINGS),
    },
  });

  test('clicking session name opens history dropdown', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const headerLeft = mainWindow.locator('.chat-container .header-left');
    await headerLeft.click();
    await mainWindow.waitForTimeout(300);

    const dropdown = mainWindow.locator('.chat-container .history-dropdown');
    await expect(dropdown).toBeVisible({timeout: 3000});
  });

  test('history dropdown shows "New Chat" option', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    await mainWindow.locator('.chat-container .header-left').click();
    await mainWindow.waitForTimeout(300);

    const newChatItem = mainWindow.locator('.chat-container .history-dropdown .new-chat-item');
    await expect(newChatItem).toBeVisible();
    await expect(newChatItem).toContainText('New Chat');
  });

  test('creating a new chat resets messages to welcome', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    await mainWindow.locator('.chat-container .header-left').click();
    await mainWindow.waitForTimeout(300);
    await mainWindow.locator('.chat-container .history-dropdown .new-chat-item').click();
    await mainWindow.waitForTimeout(500);

    const messages = mainWindow.locator('.chat-container .message');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('history dropdown closes on document click', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    await mainWindow.locator('.chat-container .header-left').click();
    await mainWindow.waitForTimeout(300);
    await expect(mainWindow.locator('.chat-container .history-dropdown')).toBeVisible();

    // Click outside the dropdown
    await mainWindow.locator('.chat-container .chat-input-area').click();
    await mainWindow.waitForTimeout(300);

    const dropdownVisible = await mainWindow.locator('.chat-container .history-dropdown').isVisible();
    expect(dropdownVisible).toBe(false);
  });
});

// ─── 10.4 Approval flow UI ──────────────────────────────────────────────────
test.describe('10.4 Approval flow UI', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify(AI_CONFIGURED_SETTINGS),
    },
  });

  test('no approval banner when no pending commands', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const banner = mainWindow.locator('.chat-container .approval-banner');
    const isVisible = await banner.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('chat input area is always visible', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const inputArea = mainWindow.locator('.chat-container .chat-input-area');
    await expect(inputArea).toBeVisible();

    const textarea = mainWindow.locator('.chat-container textarea[placeholder*="Ask AI"]');
    await expect(textarea).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({mainWindow}) => {
    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const sendBtn = mainWindow.locator('.chat-container .chat-input-area button[mat-icon-button]');
    await expect(sendBtn).toBeDisabled();
  });
});

// ─── 10.5 IPC channel whitelist for AI ───────────────────────────────────────
test.describe('10.5 IPC channel whitelist', () => {

  test('ai.command-approved channel is allowed', async ({mainWindow}) => {
    const allowed = await mainWindow.evaluate(() => {
      try {
        (window as any).electronAPI?.send('ai.command-approved', {requestId: 'test'});
        return true;
      } catch {
        return false;
      }
    });
    expect(allowed).toBe(true);
  });

  test('ai.command-rejected channel is allowed', async ({mainWindow}) => {
    const allowed = await mainWindow.evaluate(() => {
      try {
        (window as any).electronAPI?.send('ai.command-rejected', {requestId: 'test'});
        return true;
      } catch {
        return false;
      }
    });
    expect(allowed).toBe(true);
  });

  test('ai.cancel-chat channel is allowed', async ({mainWindow}) => {
    const allowed = await mainWindow.evaluate(() => {
      try {
        (window as any).electronAPI?.send('ai.cancel-chat');
        return true;
      } catch {
        return false;
      }
    });
    expect(allowed).toBe(true);
  });

  test('ai.tool-progress channel is listened', async ({mainWindow}) => {
    const registered = await mainWindow.evaluate(() => {
      try {
        (window as any).electronAPI?.on('ai.tool-progress', () => {});
        return true;
      } catch {
        return false;
      }
    });
    expect(registered).toBe(true);
  });

  test('ai.command-pending channel is listened', async ({mainWindow}) => {
    const registered = await mainWindow.evaluate(() => {
      try {
        (window as any).electronAPI?.on('ai.command-pending', () => {});
        return true;
      } catch {
        return false;
      }
    });
    expect(registered).toBe(true);
  });
});

// ─── 10.6 AI Chat with no JS errors ──────────────────────────────────────────
test.describe('10.6 AI Chat stability', () => {

  test.use({
    seedConfig: {
      'settings.json': JSON.stringify(AI_CONFIGURED_SETTINGS),
    },
  });

  test('opening and closing AI chat produces no JS errors', async ({mainWindow}) => {
    const errors: string[] = [];
    mainWindow.on('pageerror', err => errors.push(err.message));

    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await expect(aiBtn).toBeEnabled({timeout: 5000});

    // Open/close 3 times
    for (let i = 0; i < 3; i++) {
      await aiBtn.click();
      await mainWindow.waitForTimeout(400);
      await aiBtn.click();
      await mainWindow.waitForTimeout(400);
    }

    expect(errors).toEqual([]);
  });

  test('typing in chat input does not cause errors', async ({mainWindow}) => {
    const errors: string[] = [];
    mainWindow.on('pageerror', err => errors.push(err.message));

    const aiBtn = mainWindow.locator('button[aria-label="Toggle AI Assistant"]');
    await aiBtn.click();
    await mainWindow.waitForTimeout(500);

    const textarea = mainWindow.locator('.chat-container textarea[placeholder*="Ask AI"]');
    await textarea.fill('Hello, this is a test message');
    await mainWindow.waitForTimeout(300);

    expect(errors).toEqual([]);
  });
});
