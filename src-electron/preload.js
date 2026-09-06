// P0-S3: sandbox:true — preload runs WITHOUT Node.js. Only require('electron')
// works here (plus a limited `process`, e.g. process.platform). Never add
// path/fs/os or any other Node builtin: the script will fail to load and
// window.electronAPI will be undefined.
const { contextBridge, ipcRenderer } = require('electron');

// ── Core IPC channels (always allowed) ──────────────────────────────────────

const CORE_SEND_CHANNELS = [
  'log',
  'open-url',
  'session.open.terminal.local',
  'session.close.terminal.local',
  'session.open.terminal.winrm',
  'session.close.terminal.winrm',
  'terminal.input',
  'terminal.resize',
  'session.open.rd.rdp',
  'session.open.rd.spice',
  'session.disconnect.rd.vnc',
  'session.disconnect.rd.spice',
  'session.open.custom',
  'session.close.custom',
  'settings.save',
  'settings.reload',
  'profiles.save',
  'profiles.reload',
  'secrets.save',
  'secrets.reload',
  'cloud.save',
  'cloud.reload',
  'proxies.save',
  'proxies.reload',
  'trigger-native-clipboard-paste',
  'check-for-updates',
  'ai.command-approved',
  'ai.command-rejected',
  'ai.cancel-chat',
  'session.close.fe.webdav',
];

const CORE_INVOKE_CHANNELS = [
  'settings.get',
  'plugins.list',
  'plugins.getMergedManifest',
  'plugins.getExternalDir',
  'plugins.readFrontend',
  'plugins.reloadExternal',
  'plugins.listExamples',
  'plugins.installExamples',
  'plugins.enable',
  'plugins.disable',
  'acp.send',
  'acp.fetch-models',
  'acp.close',
  'ai.fetch-models',
  'ai.send-chat',
  'ai.send-with-tools',
  'session.open.rd.vnc',
  'session.open.rd.spice',
  'session.fe.scp.register',
  'session.fe.ftp.register',
  'session.fe.samba.register',
  'session.fe.sftp.register',
  'session.fe.webdav.register',
  'fe.list.webdav',
  'fe.read.webdav',
  'fe.write.webdav',
  'fe.delete.webdav',
  'fe.rename.webdav',
  'masterkey.save',
  'masterkey.exists',
  'masterkey.match',
  'masterkey.change',
  'masterkey.delete',
  'crypto.encrypt',
  'crypto.decrypt',
  'cloud.upload',
  'cloud.download',
  'local-file.save-temp',
  'local-file.open',
  'local-file.read',
  'local-file.watch',
  'local-file.unwatch',
  'get-api-token',
];

const CORE_ON_CHANNELS = [
  'error',
  'terminal.output',
  'clipboard-paste',
  'local-file.changed',
  'settings.loaded',
  'profiles.loaded',
  'secrets.loaded',
  'cloud.loaded',
  'proxies.loaded',
  'masterkey-changed',
  'acp.chunk',
  'ai.tool-progress',
  'ai.command-pending',
];

// ── Plugin IPC channels (loaded from merged manifest) ───────────────────────
// Sandbox has no fs: ask the main process (which owns the manifest files)
// via a synchronous channel. Fail closed — core channels only — if the main
// side isn't ready yet.
function loadPluginChannels() {
  try {
    const ipc = ipcRenderer.sendSync('plugins.getMergedManifestSync');
    if (ipc && Array.isArray(ipc.send) && Array.isArray(ipc.invoke) && Array.isArray(ipc.on)) {
      return ipc;
    }
  } catch {
    // main handler not registered yet — core channels only
  }
  return { send: [], invoke: [], on: [] };
}

const pluginIpc = loadPluginChannels();

const ALLOWED_SEND_CHANNELS = [...CORE_SEND_CHANNELS, ...pluginIpc.send];
const ALLOWED_INVOKE_CHANNELS = [...CORE_INVOKE_CHANNELS, ...pluginIpc.invoke];
const ALLOWED_ON_CHANNELS = [...CORE_ON_CHANNELS, ...pluginIpc.on];

// ── Context Bridge ──────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  send(channel, data) {
    if (ALLOWED_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  invoke(channel, data) {
    if (ALLOWED_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invoke channel '${channel}' is not allowed`));
  },

  on(channel, callback) {
    if (ALLOWED_ON_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => {
        const data = args[0];
        callback({ sender: null }, data);
      });
    }
  },

  removeAllListeners(channel) {
    if ([...ALLOWED_SEND_CHANNELS, ...ALLOWED_ON_CHANNELS].includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
