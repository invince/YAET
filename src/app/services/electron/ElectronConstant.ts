//#region "Common"
export const ERROR = 'error';
export const CLIPBOARD_PASTE = 'clipboard-paste';
export const TRIGGER_NATIVE_CLIPBOARD_PASTE = 'trigger-native-clipboard-paste';
export const LOG = 'log';
export const OPEN_URL = 'open-url';

export const LOCAL_FILE_SAVE_TEMP = 'local-file.save-temp';
export const LOCAL_FILE_OPEN = 'local-file.open';
export const LOCAL_FILE_WATCH = 'local-file.watch';
export const LOCAL_FILE_UNWATCH = 'local-file.unwatch';
export const LOCAL_FILE_CHANGED = 'local-file.changed';
export const LOCAL_FILE_READ = 'local-file.read';
//#endregion "Common"

//#region "Sessions"
export const SESSION_OPEN_LOCAL_TERMINAL = 'session.open.terminal.local';
export const SESSION_CLOSE_LOCAL_TERMINAL = 'session.close.terminal.local';
export const SESSION_OPEN_SSH_TERMINAL = 'session.open.terminal.ssh';
export const SESSION_CLOSE_SSH_TERMINAL = 'session.close.terminal.ssh';
export const SESSION_DISCONNECT_SSH = 'session.disconnect.terminal.ssh';
export const SESSION_OPEN_WINRM_TERMINAL = 'session.open.terminal.winrm';
export const SESSION_CLOSE_WINRM_TERMINAL = 'session.close.terminal.winrm';
export const SESSION_OPEN_TELNET_TERMINAL = 'session.open.terminal.telnet';
export const SESSION_CLOSE_TELNET_TERMINAL = 'session.close.terminal.telnet';
export const TERMINAL_INPUT = 'terminal.input';
export const TERMINAL_OUTPUT = 'terminal.output';
export const TERMINAL_RESIZE = 'terminal.resize';

export const SESSION_OPEN_RDP = 'session.open.rd.rdp';
export const SESSION_OPEN_VNC = 'session.open.rd.vnc';
export const SESSION_DISCONNECT_VNC = 'session.disconnect.rd.vnc';

export const SESSION_SCP_REGISTER = 'session.fe.scp.register';
export const SESSION_FTP_REGISTER = 'session.fe.ftp.register';
export const SESSION_SAMBA_REGISTER = 'session.fe.samba.register';

export const SESSION_OPEN_CUSTOM = 'session.open.custom';

//#endregion "Sessions"


//#region "Settings"
export const SETTINGS_RELOAD = 'settings.reload';
export const SETTINGS_SAVE = 'settings.save';
export const SETTINGS_LOADED = 'settings.loaded';
//#endregion "Settings"


//#region "Profiles"
export const PROFILES_LOADED = 'profiles.loaded';
export const PROFILES_SAVE = 'profiles.save';
export const PROFILES_RELOAD = 'profiles.reload';

//#endregion "Profiles"




//#region "Secrets"
export const SECRETS_LOADED = 'secrets.loaded';
export const SECRETS_SAVE = 'secrets.save';
export const SECRETS_RELOAD = 'secrets.reload';
export const SAVE_MASTERKEY = 'masterkey.save';
export const GET_MASTERKEY = 'masterkey.get';
export const DELETE_MASTERKEY = 'masterkey.delete';
//#endregion "Secrets"

//#region "Cloud"
export const CLOUD_LOADED = 'cloud.loaded';
export const CLOUD_SAVE = 'cloud.save';
export const CLOUD_RELOAD = 'cloud.reload';
export const CLOUD_UPLOAD = 'cloud.upload';
export const CLOUD_DOWNLOAD = 'cloud.download';
//#endregion "Cloud"

//#region "Proxies"
export const PROXIES_LOADED = 'proxies.loaded';
export const PROXIES_SAVE = 'proxies.save';
export const PROXIES_RELOAD = 'proxies.reload';
//#endregion "Proxies"


export const NODE_EXPRESS_API_ROOT = 'http://localhost:13012/api';
