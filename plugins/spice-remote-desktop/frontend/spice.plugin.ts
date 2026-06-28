import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../src/app/services/notification.service';
import {SpicePluginSession} from './main/spice-plugin-session';
import {SpiceService} from './services/spice.service';
import {SpiceComponent} from './main/spice.component';
import {SpiceProfileFormComponent} from './form/spice-profile-form.component';

export const SPICE_REMOTE_DESKTOP = 'SPICE_REMOTE_DESKTOP';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.REMOTE_DESKTOP, SPICE_REMOTE_DESKTOP, 'PROFILES.SPICE_REMOTE_DESKTOP', 'desktop_windows');
  registry.registerFormMetadata(SPICE_REMOTE_DESKTOP, 'spiceProfileForm', SPICE_REMOTE_DESKTOP);

  const tabService = injector.get(TabService);
  const spiceService = injector.get(SpiceService);
  const spinner = injector.get(NgxSpinnerService);
  const notification = injector.get(NotificationService);

  const bundledPlugin = registry.getBundledPlugin(SPICE_REMOTE_DESKTOP);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new SpicePluginSession(profile, profileType, tabService, spiceService, spinner, notification);
    bundledPlugin.formControlName = 'spiceProfileForm';
    bundledPlugin.profileField = SPICE_REMOTE_DESKTOP;
  }

  registry.register({
    manifest: {
      id: 'spice-remote-desktop',
      name: 'SPICE Remote Desktop',
      version: '1.0.0',
      category: ProfileCategory.REMOTE_DESKTOP,
      profileType: SPICE_REMOTE_DESKTOP,
      defaultPort: 5900,
      icon: 'desktop_windows',
      enabled: true,
      secretTypes: ['PASSWORD_ONLY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: SpiceProfileFormComponent,
    sessionComponent: SpiceComponent,
  });
}
