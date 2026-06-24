import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {
  RemoteTerminalProfileFormComponent
} from '../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';

export const SSH_TERMINAL = 'SSH_TERMINAL';

export function register(registry: PluginRegistryService, _injector: Injector) {
  registry.registerCategoryType(ProfileCategory.TERMINAL, SSH_TERMINAL, 'PROFILES.SSH_TERMINAL', 'terminal');

  registry.register({
    manifest: {
      id: 'ssh-terminal',
      name: 'SSH Terminal',
      version: '1.0.0',
      category: ProfileCategory.TERMINAL,
      profileType: SSH_TERMINAL,
      defaultPort: 22,
      icon: 'terminal',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD', 'SSH_KEY'],
      supportedAuthTypes: ['N/A', 'login', 'secret'],
    },
    profileFormComponent: RemoteTerminalProfileFormComponent,
    sessionComponent: null as any,
  });
}
