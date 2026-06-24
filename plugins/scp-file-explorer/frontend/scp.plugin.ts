import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {ScpService} from '../../../src/app/services/file-explorer/scp.service';
import {ScpSession} from '../../../src/app/domain/session/ScpSession';
import {ScpComponent} from '../../../src/app/components/file-explorer/scp/scp.component';
import {
  RemoteTerminalProfileFormComponent
} from '../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';

export const SCP_FILE_EXPLORER = 'SCP_FILE_EXPLORER';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.FILE_EXPLORER, SCP_FILE_EXPLORER, 'PROFILES.SCP_FILE_EXPLORER', 'folder');
  registry.registerFormMetadata(SCP_FILE_EXPLORER, 'remoteTerminalProfileForm', 'SSH_TERMINAL');

  const tabService = injector.get(TabService);
  const scpService = injector.get(ScpService);

  const bundledPlugin = registry.getBundledPlugin(SCP_FILE_EXPLORER);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new ScpSession(profile, profileType, tabService, scpService);
    bundledPlugin.formControlName = 'remoteTerminalProfileForm';
    bundledPlugin.profileField = 'SSH_TERMINAL';
  }

  registry.register({
    manifest: {
      id: 'scp-file-explorer',
      name: 'SCP File Explorer',
      version: '1.0.0',
      category: ProfileCategory.FILE_EXPLORER,
      profileType: SCP_FILE_EXPLORER,
      defaultPort: 22,
      icon: 'folder',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD', 'PASSWORD_ONLY', 'SSH_KEY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: RemoteTerminalProfileFormComponent,
    sessionComponent: ScpComponent,
  });
}
