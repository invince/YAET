import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory, ProfileType} from '../../../src/app/domain/profile/Profile';
import {RdpProfileFormComponent} from './form/rdp-profile-form.component';

export function registerRdpPlugin(registry: PluginRegistryService) {
  const bundledPlugin = registry.getBundledPlugin(ProfileType.RDP_REMOTE_DESKTOP);
  if (bundledPlugin) {
    bundledPlugin.formControlName = 'rdpProfileForm';
    bundledPlugin.profileField = 'rdpProfile';
  }

  registry.register({
    manifest: {
      id: 'rdp-remote-desktop',
      name: 'RDP Remote Desktop',
      version: '1.0.0',
      category: ProfileCategory.REMOTE_DESKTOP,
      profileType: ProfileType.RDP_REMOTE_DESKTOP,
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
