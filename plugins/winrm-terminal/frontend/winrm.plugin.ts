import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {
  RemoteTerminalProfileFormComponent
} from '../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';

export const WIN_RM_TERMINAL = 'WIN_RM_TERMINAL';

export function register(registry: PluginRegistryService, _injector: Injector) {
  registry.registerCategoryType(ProfileCategory.TERMINAL, WIN_RM_TERMINAL, 'PROFILES.WIN_RM_TERMINAL', 'terminal');
  registry.registerFormMetadata(WIN_RM_TERMINAL, 'remoteTerminalProfileForm', WIN_RM_TERMINAL);

  registry.register({
    manifest: {
      id: 'winrm-terminal',
      name: 'WinRM Terminal',
      version: '1.0.0',
      category: ProfileCategory.TERMINAL,
      profileType: WIN_RM_TERMINAL,
      defaultPort: 5985,
      icon: 'terminal',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD'],
      supportedAuthTypes: ['N/A', 'login', 'secret'],
    },
    profileFormComponent: RemoteTerminalProfileFormComponent,
    sessionComponent: null as any,
  });
}
