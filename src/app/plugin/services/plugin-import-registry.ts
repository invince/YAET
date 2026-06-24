/**
 * Plugin Import Registry — static import map for bundled plugins.
 *
 * Each entry maps a plugin ID to a dynamic import() with a string literal.
 * Webpack can statically analyze these and create separate chunks.
 * The session.service.ts reads this map at runtime — no direct plugin imports.
 */

export interface BundledPluginImport {
  register: () => Promise<{register: Function}>;
}

const PLUGIN_IMPORTS: Record<string, () => Promise<any>> = {
  'ssh-terminal': () => import('../../../../plugins/ssh-terminal/frontend/ssh.plugin'),
  'telnet-terminal': () => import('../../../../plugins/telnet-terminal/frontend/telnet.plugin'),
  'winrm-terminal': () => import('../../../../plugins/winrm-terminal/frontend/winrm.plugin'),
  'vnc-remote-desktop': () => import('../../../../plugins/vnc-remote-desktop/frontend/vnc.plugin'),
  'rdp-remote-desktop': () => import('../../../../plugins/rdp-remote-desktop/frontend/rdp.plugin'),
  'scp-file-explorer': () => import('../../../../plugins/scp-file-explorer/frontend/scp.plugin'),
  'ftp-file-explorer': () => import('../../../../plugins/ftp-file-explorer/frontend/ftp.plugin'),
  'samba-file-explorer': () => import('../../../../plugins/samba-file-explorer/frontend/samba.plugin'),
};

export async function loadBundledPluginModule(pluginId: string): Promise<any> {
  const loader = PLUGIN_IMPORTS[pluginId];
  if (!loader) {
    console.warn(`[PluginRegistry] No import registered for plugin: ${pluginId}`);
    return null;
  }
  return loader();
}

export function getRegisteredPluginIds(): string[] {
  return Object.keys(PLUGIN_IMPORTS);
}
