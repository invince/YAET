import {Profile} from '../profile/Profile';
import {TabService} from '../../services/tab.service';
import {Session} from './Session';
import {SecretStorageService} from '../../services/secret-storage.service';
import {resolveSecretToConfig} from '../../utils/SecretResolver';

declare const window: any;

/**
 * Generic session for bundled plugins.
 *
 * Uses IPC channel names from the plugin manifest to open/close sessions.
 * Registers listeners for disconnect and error events from the backend.
 */
export class PluginSession extends Session {
  private channels: { open: string; close: string; disconnect: string; errorCategory: string };
  private profileData: any;
  private cleanupFns: (() => void)[] = [];

  constructor(
    profile: Profile,
    profileType: string,
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

      if (!resolveSecretToConfig(config, this.profileData, this.secretStorage, (m) => console.log('[PluginSession]', m))) {
        console.error('[PluginSession] Secret resolution failed');
        return;
      }

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

      // Listen for disconnect events from the backend
      const disconnectHandler = (_event: any, resp: any) => {
        if (resp?.id === this.id) {
          this.tabService.disconnected(this.id);
        }
      };
      ipc.on(this.channels.disconnect, disconnectHandler);
      this.cleanupFns.push(() => ipc.removeAllListeners(this.channels.disconnect));

      // Listen for error events from the backend
      const errorHandler = (_event: any, resp: any) => {
        if (resp?.category === this.channels.errorCategory && resp?.id === this.id) {
          this.tabService.removeById(this.id);
        }
      };
      ipc.on('error', errorHandler);
      this.cleanupFns.push(() => ipc.removeAllListeners('error'));
    }
    super.open();
  }

  override close(): void {
    const ipc = (window as any).electronAPI;
    if (ipc) {
      ipc.send(this.channels.close, {terminalId: this.id});
    }
    // Clean up IPC listeners
    for (const fn of this.cleanupFns) fn();
    this.cleanupFns = [];
    super.close();
  }
}
