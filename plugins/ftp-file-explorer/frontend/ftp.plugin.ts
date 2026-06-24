import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {FtpService} from '../../../src/app/services/file-explorer/ftp.service';
import {FtpSession} from '../../../src/app/domain/session/FtpSession';
import {FtpComponent} from '../../../src/app/components/file-explorer/ftp/ftp.component';
import {
  FtpProfileFormComponent
} from '../../../src/app/components/menu/profile-form/ftp-profile-form/ftp-profile-form.component';

export const FTP_FILE_EXPLORER = 'FTP_FILE_EXPLORER';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.FILE_EXPLORER, FTP_FILE_EXPLORER, 'PROFILES.FTP_FILE_EXPLORER', 'folder');
  registry.registerFormMetadata(FTP_FILE_EXPLORER, 'ftpProfileForm', FTP_FILE_EXPLORER);

  const tabService = injector.get(TabService);
  const ftpService = injector.get(FtpService);

  const bundledPlugin = registry.getBundledPlugin(FTP_FILE_EXPLORER);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new FtpSession(profile, profileType, tabService, ftpService);
    bundledPlugin.formControlName = 'ftpProfileForm';
    bundledPlugin.profileField = FTP_FILE_EXPLORER;
  }

  registry.register({
    manifest: {
      id: 'ftp-file-explorer',
      name: 'FTP File Explorer',
      version: '1.0.0',
      category: ProfileCategory.FILE_EXPLORER,
      profileType: FTP_FILE_EXPLORER,
      defaultPort: 21,
      icon: 'folder',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD', 'PASSWORD_ONLY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: FtpProfileFormComponent,
    sessionComponent: FtpComponent,
  });
}
