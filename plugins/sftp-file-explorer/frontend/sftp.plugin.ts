import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {SftpService} from './services/sftp.service';
import {SftpSession} from './main/sftp-session';
import {
  RemoteTerminalProfileFormComponent
} from '../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';

export const SFTP_FILE_EXPLORER = 'SFTP_FILE_EXPLORER';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.FILE_EXPLORER, SFTP_FILE_EXPLORER, 'PROFILES.SFTP_FILE_EXPLORER', 'folder');
  registry.registerFormMetadata(SFTP_FILE_EXPLORER, 'remoteTerminalProfileForm', 'SSH_TERMINAL');

  const tabService = injector.get(TabService);
  const sftpService = injector.get(SftpService);

  const bundledPlugin = registry.getBundledPlugin(SFTP_FILE_EXPLORER);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new SftpSession(profile, profileType, tabService, sftpService);
    bundledPlugin.formControlName = 'remoteTerminalProfileForm';
    bundledPlugin.profileField = 'SSH_TERMINAL';
  }

  registry.register({
    manifest: {
      id: 'sftp-file-explorer',
      name: 'SFTP File Explorer',
      version: '1.0.0',
      category: ProfileCategory.FILE_EXPLORER,
      profileType: SFTP_FILE_EXPLORER,
      defaultPort: 22,
      icon: 'folder',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD', 'PASSWORD_ONLY', 'SSH_KEY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: RemoteTerminalProfileFormComponent,
  });
}
