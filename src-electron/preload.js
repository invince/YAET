const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

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
  'session.disconnect.rd.vnc',
  'session.open.custom',
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
  'session.close.fe.webdav',
];

const CORE_INVOKE_CHANNELS = [
  'settings.get',
  'plugins.list',
  'plugins.getMergedManifest',
  'plugins.getExternalDir',
  'plugins.readFrontend',
  'plugins.reloadExternal',
  'acp.send',
  'acp.fetch-models',
  'ai.fetch-models',
  'ai.send-chat',
  'ai.send-with-tools',
  'session.open.rd.vnc',
  'session.fe.scp.register',
  'session.fe.ftp.register',
  'session.fe.samba.register',
  'session.fe.webdav.register',
  'fe.list.webdav',
  'fe.read.webdav',
  'fe.write.webdav',
  'fe.delete.webdav',
  'fe.rename.webdav',
  'masterkey.save',
  'masterkey.get',
  'masterkey.delete',
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

function loadPluginChannels() {
  const bundledPath = path.join(__dirname, '../plugins/generated-plugin-manifest.json');
  const externalPath = path.join(os.homedir(), '.yaet', 'plugins', 'generated-plugin-manifest.json');

  const manifestPath = fs.existsSync(externalPath) ? externalPath : bundledPath;
  if (!fs.existsSync(manifestPath)) {
    return { send: [], invoke: [], on: [] };
  }
  try {
    const merged = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return merged.ipc || { send: [], invoke: [], on: [] };
  } catch {
    return { send: [], invoke: [], on: [] };
  }
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
