import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {SambaService} from '../../../src/app/services/file-explorer/samba.service';
import {SambaSession} from '../../../src/app/domain/session/SambaSession';
import {SambaComponent} from '../../../src/app/components/file-explorer/samba/samba.component';
import {SambaFormComponent} from '../../../src/app/components/menu/profile-form/samba-form/samba-form.component';

export const SAMBA_FILE_EXPLORER = 'SAMBA_FILE_EXPLORER';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.FILE_EXPLORER, SAMBA_FILE_EXPLORER, 'PROFILES.SAMBA_FILE_EXPLORER', 'folder');

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
      icon: 'folder',
      enabled: true,
      secretTypes: ['LOGIN_PASSWORD'],
      supportedAuthTypes: ['login'],
    },
    profileFormComponent: SambaFormComponent,
    sessionComponent: SambaComponent,
  });
}
