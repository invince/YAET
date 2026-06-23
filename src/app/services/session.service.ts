import {Injectable} from '@angular/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {Profile, ProfileType} from '../domain/profile/Profile';
import {FtpSession} from '../domain/session/FtpSession';
import {LocalTerminalSession} from '../domain/session/LocalTerminalSession';
import {PluginSession} from '../domain/session/PluginSession';
import {SambaSession} from '../domain/session/SambaSession';
import {ScpSession} from '../domain/session/ScpSession';
import {Session} from '../domain/session/Session';
import {WinRMSession} from '../domain/session/WinRMSession';
import {TabInstance} from '../domain/TabInstance';
import {ElectronRemoteDesktopService} from './electron/electron-remote-desktop.service';
import {ElectronTerminalService} from './electron/electron-terminal.service';
import {FtpService} from './file-explorer/ftp.service';
import {SambaService} from './file-explorer/samba.service';
import {ScpService} from './file-explorer/scp.service';
import {NotificationService} from './notification.service';
import {PluginRegistryService} from './plugin/plugin-registry.service';
import {SecretStorageService} from './secret-storage.service';
import {VncService} from './remote-desktop/vnc.service';
import {TabService} from './tab.service';

import {VncPluginSession} from '../../../plugins/vnc-remote-desktop/frontend/vnc-plugin-session';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  constructor(
    private tabService: TabService,
    private spinner: NgxSpinnerService,
    private notification: NotificationService,

    private electronTerm: ElectronTerminalService,
    private electronRD: ElectronRemoteDesktopService,
    private vncService: VncService,

    private scpService: ScpService,
    private ftpService: FtpService,
    private sambaService: SambaService,

    private registry: PluginRegistryService,
    private secretStorage: SecretStorageService,
  ) { }

  initSessionFactories(): void {
    const vncPlugin = this.registry.getBundledPlugin(ProfileType.VNC_REMOTE_DESKTOP);
    if (vncPlugin) {
      vncPlugin.sessionFactory = (profile, profileType) =>
        new VncPluginSession(profile, profileType, this.tabService, this.vncService, this.spinner, this.notification);
    }
  }


  create(profile: Profile, profileType: ProfileType): Session {
    // 1. Check if it's an external plugin → use generic PluginSession
    const externalPlugin = this.registry.getExternalPlugin(profileType);
    if (externalPlugin) {
      return this.createPluginSession(profile, profileType, externalPlugin);
    }

    // 2. Bundled plugins with backend → use sessionFactory if available, otherwise generic PluginSession
    const pluginInfo = this.registry.getBundledPlugin(profileType);
    if (pluginInfo) {
      if (pluginInfo.sessionFactory) {
        return pluginInfo.sessionFactory(profile, profileType);
      }
      return this.createPluginSession(profile, profileType, pluginInfo);
    }

    // 3. Built-in types (will be migrated to plugins over time)
    switch (profileType) {
      case ProfileType.LOCAL_TERMINAL:
        return new LocalTerminalSession(profile, profileType, this.tabService, this.electronTerm);
      case ProfileType.WIN_RM_TERMINAL:
        return new WinRMSession(profile, profileType, this.tabService, this.electronTerm);

      case ProfileType.SAMBA_FILE_EXPLORER:
        return new SambaSession(profile, profileType, this.tabService, this.sambaService)

      case ProfileType.SCP_FILE_EXPLORER:
        return new ScpSession(profile, profileType, this.tabService, this.scpService);
      case ProfileType.FTP_FILE_EXPLORER:
        return new FtpSession(profile, profileType, this.tabService, this.ftpService);
    }

    return new Session(profile, profileType, this.tabService);
  }

  /**
   * Create a generic session for an external plugin.
   * Reads IPC channels from the registry and profile data from the profile.
   */
  private createPluginSession(profile: Profile, profileType: string, plugin: any): PluginSession {
    // Map profileType to the profile data field
    const profileFieldMap: Record<string, string> = {
      'SSH_TERMINAL': 'sshProfile',
      'TELNET_TERMINAL': 'telnetProfile',
    };
    const profileField = profileFieldMap[profileType] || 'sshProfile';
    const profileData = (profile as any)[profileField] || {};

    // Use IPC channels from the plugin manifest (not generated from profileType)
    const ipcChannels = plugin.ipcChannels || {};
    const channels = {
      open: ipcChannels.send?.[0] || `session.open.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`,
      close: ipcChannels.send?.[1] || `session.close.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`,
      disconnect: ipcChannels.on?.[0] || `session.disconnect.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`,
      errorCategory: profileType.toLowerCase().replace(/_/g, '-'),
    };

    return new PluginSession(profile, profileType as ProfileType, this.tabService, channels, profileData, this.secretStorage);
  }

  openSessionWithoutTab(profile: Profile) {
    if (profile) {
      switch (profile.profileType) {
        case ProfileType.RDP_REMOTE_DESKTOP:
          if (!profile.rdpProfile || !profile.rdpProfile.host) {
            this.notification.error('Invalid Rdp Config');
            return;
          }
          this.electronRD.openRdpSession(profile.rdpProfile);
          break;
        case ProfileType.CUSTOM:
          if (!profile.customProfile || !profile.customProfile.execPath) {
            this.notification.error('Invalid Custom Profile');
            return;
          }
          this.electronTerm.openCustomSession(profile.customProfile);
          break;
      }
    }
  }

  reconnect(i: number) {
    if (this.tabService.tabs) {
      let oldTab = this.tabService.tabs[i];
      let oldSession = oldTab.session;
      let newSession = this.create(oldSession.profile, oldSession.profileType);
      let newTab = new TabInstance(oldTab.category, newSession);
      newTab.name = oldTab.name;
      newTab.paneId = oldTab.paneId;
      newTab.connected = true;
      this.tabService.tabs[i] = newTab;
    }
  }
}
