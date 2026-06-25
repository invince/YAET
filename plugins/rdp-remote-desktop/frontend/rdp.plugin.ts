import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {RdpSession} from './main/rdp-session';
import {RdpProfileFormComponent} from './form/rdp-profile-form.component';

export const RDP_REMOTE_DESKTOP = 'RDP_REMOTE_DESKTOP';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.REMOTE_DESKTOP, RDP_REMOTE_DESKTOP, 'PROFILES.RDP_REMOTE_DESKTOP', 'desktop_windows');
  registry.registerFormMetadata(RDP_REMOTE_DESKTOP, 'rdpProfileForm', RDP_REMOTE_DESKTOP);

  const tabService = injector.get(TabService);

  const bundledPlugin = registry.getBundledPlugin(RDP_REMOTE_DESKTOP);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new RdpSession(profile, profileType, tabService);
    bundledPlugin.formControlName = 'rdpProfileForm';
    bundledPlugin.profileField = RDP_REMOTE_DESKTOP;
  }

  registry.register({
    manifest: {
      id: 'rdp-remote-desktop',
      name: 'RDP Remote Desktop',
      version: '1.0.0',
      category: ProfileCategory.REMOTE_DESKTOP,
      profileType: RDP_REMOTE_DESKTOP,
      defaultPort: 3389,
      icon: 'desktop_windows',
      enabled: true,
      secretTypes: [],
      supportedAuthTypes: [],
    },
    profileFormComponent: RdpProfileFormComponent,
    sessionComponent: null as any,
  });
}
