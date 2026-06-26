import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {
  RemoteTerminalProfileFormComponent
} from '../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';

export const TELNET_TERMINAL = 'TELNET_TERMINAL';

export function register(registry: PluginRegistryService, _injector: Injector) {
  registry.registerCategoryType(ProfileCategory.TERMINAL, TELNET_TERMINAL, 'PROFILES.TELNET_TERMINAL', 'terminal');
  registry.registerFormMetadata(TELNET_TERMINAL, 'remoteTerminalProfileForm', TELNET_TERMINAL);

  registry.register({
    manifest: {
      id: 'telnet-terminal',
      name: 'Telnet Terminal',
      version: '1.0.0',
      category: ProfileCategory.TERMINAL,
      profileType: TELNET_TERMINAL,
      defaultPort: 23,
      icon: 'terminal',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD'],
      supportedAuthTypes: ['N/A', 'login', 'secret'],
    },
    profileFormComponent: RemoteTerminalProfileFormComponent,
    sessionComponent: null as any,
  });
}
