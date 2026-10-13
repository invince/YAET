/**
 * Unit tests for the tunnels IPC approval round-trip (public -R tunnels).
 * Stubs 'electron' before requiring the adapter, then drives the captured
 * ipcMain handlers directly — no windows, no SSH.
 * Run: node --test src-electron/adapter/ipc/tunnels.spec.js
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const handlers = {};
require.cache[require.resolve('electron')] = {
  exports: {
    app: { on: () => {} },
    ipcMain: {
      handle: (channel, fn) => { handlers[channel] = fn; },
      on: (channel, fn) => { handlers[channel] = fn; },
    },
  },
  loaded: true,
};

const { requestApproval, initTunnelsIpcHandler } = require('./tunnels');

function makeWindow() {
  const sent = [];
  return {
    sent,
    window: {
      isDestroyed: () => false,
      webContents: { send: (channel, data) => { sent.push({ channel, data }); } },
    },
  };
}

const log = { info: () => {}, warn: () => {}, error: () => {} };

// Register all tunnels IPC handlers against the fake ipcMain above.
initTunnelsIpcHandler(log, {}, makeWindow().window);

describe('tunnels IPC approval', () => {
  let win;
  beforeEach(() => {
    win = makeWindow();
  });

  it('sends an approval request and resolves true on allow', async () => {
    const pending = requestApproval(log, win.window, { tunnelId: 't1', tunnelName: 'n', srcIP: '1.2.3.4', srcPort: 5, dstPort: 6 }, {});
    await new Promise((r) => setImmediate(r));
    assert.equal(win.sent.length, 1);
    assert.equal(win.sent[0].channel, 'tunnels.approval-request');
    const { requestId } = win.sent[0].data;
    assert.ok(requestId);
    assert.equal(win.sent[0].data.srcIP, '1.2.3.4');

    handlers['tunnels.approval-resolve']({}, { requestId, approved: true });
    assert.deepEqual(await pending, { approved: true, trustSource: false });
  });

  it('resolves false on deny', async () => {
    const pending = requestApproval(log, win.window, { tunnelId: 't1' }, {});
    await new Promise((r) => setImmediate(r));
    const { requestId } = win.sent[0].data;
    handlers['tunnels.approval-resolve']({}, { requestId, approved: false });
    assert.deepEqual(await pending, { approved: false, trustSource: false });
  });

  it('ignores unknown request ids', async () => {
    const pending = requestApproval(log, win.window, { tunnelId: 't1' }, {});
    await new Promise((r) => setImmediate(r));
    handlers['tunnels.approval-resolve']({}, { requestId: 'ghost', approved: true });
    // still pending — settle it properly so the test exits cleanly
    const { requestId } = win.sent[0].data;
    handlers['tunnels.approval-resolve']({}, { requestId, approved: true });
    assert.deepEqual(await pending, { approved: true, trustSource: false });
  });

  it('resolves false immediately for an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await requestApproval(log, win.window, { tunnelId: 't1' }, { signal: controller.signal });
    assert.equal(result, false);
    assert.equal(win.sent.length, 0);
  });

  it('resolves false when the window is gone', async () => {
    const dead = { isDestroyed: () => true, webContents: { send: () => { throw new Error('unreachable'); } } };
    assert.equal(await requestApproval(log, dead, { tunnelId: 't1' }, {}), false);
  });
});
