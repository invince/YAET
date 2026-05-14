const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_SEND_CHANNELS = [
  'log',
  'open-url',
  'session.open.terminal.local',
  'session.close.terminal.local',
  'session.open.terminal.ssh',
  'session.close.terminal.ssh',
  'session.open.terminal.winrm',
  'session.close.terminal.winrm',
  'session.open.terminal.telnet',
  'session.close.terminal.telnet',
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
];

const ALLOWED_INVOKE_CHANNELS = [
  'acp.send',
  'acp.fetch-models',
  'ai.fetch-models',
  'session.open.rd.vnc',
  'session.fe.scp.register',
  'session.fe.ftp.register',
  'session.fe.samba.register',
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

const ALLOWED_ON_CHANNELS = [
  'error',
  'session.disconnect.terminal.ssh',
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
];

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
