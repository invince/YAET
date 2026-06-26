import {Injectable, Injector} from '@angular/core';
import {CUSTOM_PROFILE, LOCAL_TERMINAL, Profile} from '../domain/profile/Profile';
import {LocalTerminalSession} from '../domain/session/LocalTerminalSession';
import {PluginSession} from '../domain/session/PluginSession';
import {Session} from '../domain/session/Session';
import {TabInstance} from '../domain/TabInstance';
import {ElectronTerminalService} from './electron/electron-terminal.service';
import {PluginRegistryService} from '../plugin/services/plugin-registry.service';
import {getRegisteredPluginIds, loadBundledPluginModule} from '../plugin/services/plugin-import-registry';
import '../../../plugins/generated-plugin-registry';
import {SecretStorageService} from './secret-storage.service';
import {TabService} from './tab.service';

@Injectable({
  providedIn: 'root'
})
export class SessionService {

  constructor(
    private tabService: TabService,
    private electronTerm: ElectronTerminalService,

    private registry: PluginRegistryService,
    private secretStorage: SecretStorageService,
    private injector: Injector,
  ) { }

  initSessionFactories(): void {
    this.loadBundledPlugins();
  }

  private loadBundledPlugins(): void {
    const pluginIds = getRegisteredPluginIds();

    for (const pluginId of pluginIds) {
      try {
        const module = loadBundledPluginModule(pluginId);
        if (module && typeof module.register === 'function') {
          module.register(this.registry, this.injector);
        }
      } catch (err) {
        console.error(`[SessionService] Failed to load plugin ${pluginId}:`, err);
      }
    }
  }

  create(profile: Profile, profileType: string): Session {
    // 1. Core built-in types
    if (profileType === LOCAL_TERMINAL) {
      return new LocalTerminalSession(profile, profileType, this.tabService, this.electronTerm);
    }
    if (profileType === CUSTOM_PROFILE) {
      return new Session(profile, profileType, this.tabService);
    }

    // 2. Bundled plugins — use sessionFactory if available, otherwise generic PluginSession
    const pluginInfo = this.registry.getBundledPlugin(profileType);
    if (pluginInfo) {
      if (pluginInfo.sessionFactory) {
        return pluginInfo.sessionFactory(profile, profileType);
      }
      return this.createPluginSession(profile, profileType, pluginInfo);
    }

    // 3. External plugins — use generic PluginSession
    const externalPlugin = this.registry.getExternalPlugin(profileType);
    if (externalPlugin) {
      return this.createPluginSession(profile, profileType, externalPlugin);
    }

    // 4. Unknown type — fallback
    return new Session(profile, profileType, this.tabService);
  }

  private createPluginSession(profile: Profile, profileType: string, plugin: any): PluginSession {
    const profileData = profile.getProfile(profileType) || {};

    const ipcChannels = plugin.ipcChannels || {};
    const openChannel = ipcChannels.invoke?.[0] || ipcChannels.send?.[0] || `session.open.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`;
    const channels = {
      open: openChannel,
      close: ipcChannels.send?.[1] || `session.close.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`,
      disconnect: ipcChannels.on?.[0] || `session.disconnect.terminal.${profileType.toLowerCase().replace(/_/g, '-')}`,
      errorCategory: profileType.toLowerCase().replace(/_/g, '-'),
      openIsInvoke: !!ipcChannels.invoke?.[0],
    };

    return new PluginSession(profile, profileType, this.tabService, channels, profileData, this.secretStorage);
  }

  openSessionWithoutTab(profile: Profile) {
    if (!profile) return;
    // RDP and CUSTOM open external programs, not tabs
    // Plugins register sessionFactory that handles this via open() override
    const pluginInfo = this.registry.getBundledPlugin(profile.profileType);
    if (pluginInfo?.sessionFactory) {
      const session = pluginInfo.sessionFactory(profile, profile.profileType);
      session.open();
      return;
    }
    if (profile.profileType === CUSTOM_PROFILE) {
      const customProfile = profile.getProfile('CUSTOM');
      if (customProfile?.execPath) {
        this.electronTerm.openCustomSession(customProfile);
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
