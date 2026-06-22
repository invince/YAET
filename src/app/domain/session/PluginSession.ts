import {Profile, ProfileType} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';
import {SecretStorageService} from '../../services/secret-storage.service';
import {resolveSecretToConfig} from '../../utils/SecretResolver';

declare const window: any;

/**
 * Generic session for external plugins.
 *
 * Uses IPC channel names from the plugin manifest to open/close sessions.
 * Resolves secrets before sending IPC (same as built-in electron services).
 */
export class PluginSession extends Session {
  private channels: { open: string; close: string; disconnect: string; errorCategory: string };
  private profileData: any;

  constructor(
    profile: Profile,
    profileType: ProfileType,
    tabService: TabService,
    channels: { open: string; close: string; disconnect: string; errorCategory: string },
    profileData: any,
    private secretStorage: SecretStorageService,
  ) {
    super(profile, profileType, tabService);
    this.channels = channels;
    this.profileData = profileData;
  }

  override open(): void {
    const ipc = (window as any).electronAPI;
    if (ipc) {
      const config: any = {
        readyTimeout: 30000,
        keepaliveInterval: 15000,
        keepaliveCountMax: 5,
        host: this.profileData.host,
        port: this.profileData.port,
      };

      console.log('[PluginSession] Opening:', this.channels.open, 'host:', config.host, 'profileData:', JSON.stringify(this.profileData));

      if (!resolveSecretToConfig(config, this.profileData, this.secretStorage, (m) => console.log('[PluginSession]', m))) {
        console.error('[PluginSession] Secret resolution failed');
        return;
      }

      console.log('[PluginSession] Resolved config:', JSON.stringify(config));

      const data: any = {
        terminalId: this.id,
        config,
      };
      if (this.profile?.proxyId) {
        data.proxyId = this.profile.proxyId;
      }
      if (this.profileData.initPath) {
        data.initPath = this.profileData.initPath;
      }
      if (this.profileData.initCmd) {
        data.initCmd = this.profileData.initCmd;
      }

      ipc.send(this.channels.open, data);
      console.log('[PluginSession] IPC sent, sessionId:', this.id);
    }
    super.open();
  }

  override close(): void {
    const ipc = (window as any).electronAPI;
    if (ipc) {
      ipc.send(this.channels.close, {terminalId: this.id});
    }
    super.close();
  }
}
