import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {SambaService} from './services/samba.service';
import {SambaSession} from './main/samba-session';
import {SambaFormComponent} from './form/samba-form.component';

export const SAMBA_FILE_EXPLORER = 'SAMBA_FILE_EXPLORER';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.FILE_EXPLORER, SAMBA_FILE_EXPLORER, 'PROFILES.SAMBA_FILE_EXPLORER', 'folder_shared');
  registry.registerFormMetadata(SAMBA_FILE_EXPLORER, 'sambaProfileForm', SAMBA_FILE_EXPLORER);

  const tabService = injector.get(TabService);
  const sambaService = injector.get(SambaService);

  const bundledPlugin = registry.getBundledPlugin(SAMBA_FILE_EXPLORER);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new SambaSession(profile, profileType, tabService, sambaService);
    bundledPlugin.formControlName = 'sambaProfileForm';
    bundledPlugin.profileField = SAMBA_FILE_EXPLORER;
  }

  registry.register({
    manifest: {
      id: 'samba-file-explorer',
      name: 'Samba File Explorer',
      version: '1.0.0',
      category: ProfileCategory.FILE_EXPLORER,
      profileType: SAMBA_FILE_EXPLORER,
      defaultPort: 445,
      icon: 'folder_shared',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD', 'PASSWORD_ONLY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: SambaFormComponent,
  });
}
