/**
 * IPC adapter for the SSH tunnel manager (A1).
 *
 * Channels (all allow-listed in preload.js CORE_*_CHANNELS):
 * - invoke 'tunnels.list'     → TunnelService.list()
 * - invoke 'tunnels.start'     { tunnelId } → snapshot (throws on error)
 * - invoke 'tunnels.stop'      { tunnelId } → boolean
 * - invoke 'tunnels.stop-all'  → void
 * - on     'tunnels.status-changed' → full snapshot list on every transition
 *
 * Only IDs cross the boundary — the tunnel itself is re-read server-side
 * from the encrypted tunnels file (RuntimeAPI.resolveTunnel).
 */
const { app, ipcMain } = require('electron');
const { TunnelService } = require('../../services/tunnelService');

/** Incoming-connection approval dialog round-trip budget (fail closed). */
const APPROVAL_TIMEOUT_MS = 60000;

let service = null;
let approvalSeq = 0;
/** requestId -> { settle } for in-flight approval dialogs. */
const pendingApprovals = new Map();

function getService(log, runtime) {
  if (!service) {
    service = new TunnelService(log, { runtime });
  }
  return service;
}

/**
 * Ask the renderer to approve one inbound connection on a publicly-bound
 * tunnel. Resolves false on deny, timeout, stop (abort), send failure, or
 * a dead window — never leaves the SSH channel hanging.
 */
function requestApproval(log, mainWindow, info, { signal } = {}) {
  return new Promise((resolve) => {
    const requestId = `tunnel-approval-${Date.now().toString(36)}-${(approvalSeq += 1)}`;
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId);
      log.warn(`Tunnel approval ${requestId} timed out — connection rejected`);
      resolve(false);
    }, APPROVAL_TIMEOUT_MS);
    if (timer.unref) timer.unref();

    const settle = (outcome) => {
      if (!pendingApprovals.has(requestId)) return;
      pendingApprovals.delete(requestId);
      clearTimeout(timer);
      // Pass the outcome object through ({ approved, trustSource });
      // TunnelService normalizes bare booleans (timeout/abort paths).
      resolve(outcome && typeof outcome === 'object' ? outcome : !!outcome);
    };
    pendingApprovals.set(requestId, { settle });

    if (signal) {
      if (signal.aborted) {
        settle(false);
        return;
      }
      signal.addEventListener('abort', () => settle(false), { once: true });
    }

    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tunnels.approval-request', { requestId, ...info });
      } else {
        settle(false);
      }
    } catch (err) {
      log.warn(`Tunnel approval request failed: ${err.message}`);
      settle(false);
    }
  });
}

function initTunnelsIpcHandler(log, runtime, mainWindow) {
  const tunnels = getService(log, runtime);
  tunnels.requestApproval = (info, opts) => requestApproval(log, mainWindow, info, opts);

  const broadcast = (list) => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('tunnels.status-changed', list);
      }
    } catch (err) {
      log.warn(`tunnels.status-changed broadcast failed: ${err.message}`);
    }
  };
  tunnels.broadcast = broadcast;

  ipcMain.handle('tunnels.list', async () => {
    return tunnels.list();
  });

  ipcMain.handle('tunnels.start', async (event, data) => {
    if (!data || !data.tunnelId) {
      throw new Error('tunnels.start requires { tunnelId }');
    }
    return tunnels.start(data.tunnelId);
  });

  ipcMain.handle('tunnels.stop', async (event, data) => {
    if (!data || !data.tunnelId) {
      throw new Error('tunnels.stop requires { tunnelId }');
    }
    return tunnels.stop(data.tunnelId);
  });

  ipcMain.handle('tunnels.stop-all', async () => {
    await tunnels.stopAll();
    return true;
  });

  ipcMain.on('tunnels.approval-resolve', (_event, data) => {
    const pending = data && pendingApprovals.get(data.requestId);
    if (pending) {
      pending.settle({ approved: !!data.approved, trustSource: !!data.trustSource });
    }
  });

  // Never leave listeners/ssh connections behind on quit (same pattern as
  // customSession's will-quit cleanup).
  app.on('will-quit', () => {
    try {
      // stopAll is async; will-quit cannot wait — tear down synchronously.
      for (const entry of tunnels.tunnels.values()) {
        entry.stoppedByUser = true;
        if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
        tunnels._teardown(entry, false);
      }
    } catch (err) {
      log.warn(`tunnel will-quit cleanup failed: ${err.message}`);
    }
  });

  return tunnels;
}

module.exports = { initTunnelsIpcHandler, getService, requestApproval, APPROVAL_TIMEOUT_MS };
