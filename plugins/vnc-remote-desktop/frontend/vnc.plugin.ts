import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {Profile, ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../src/app/services/notification.service';
import {VncPluginSession} from './vnc-plugin-session';
import {VncService} from './services/vnc.service';
import {VncComponent} from './main/vnc.component';
import {VncProfileFormComponent} from './form/vnc-profile-form.component';

export const VNC_REMOTE_DESKTOP = 'VNC_REMOTE_DESKTOP';

export function register(registry: PluginRegistryService, injector: Injector) {
  registry.registerCategoryType(ProfileCategory.REMOTE_DESKTOP, VNC_REMOTE_DESKTOP, 'PROFILES.VNC_REMOTE_DESKTOP', 'desktop_windows');
  registry.registerFormMetadata(VNC_REMOTE_DESKTOP, 'vncProfileForm', VNC_REMOTE_DESKTOP);

  const tabService = injector.get(TabService);
  const vncService = injector.get(VncService);
  const spinner = injector.get(NgxSpinnerService);
  const notification = injector.get(NotificationService);

  const bundledPlugin = registry.getBundledPlugin(VNC_REMOTE_DESKTOP);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile: Profile, profileType: string) =>
      new VncPluginSession(profile, profileType, tabService, vncService, spinner, notification);
    bundledPlugin.formControlName = 'vncProfileForm';
    bundledPlugin.profileField = VNC_REMOTE_DESKTOP;
  }

  registry.register({
    manifest: {
      id: 'vnc-remote-desktop',
      name: 'VNC Remote Desktop',
      version: '1.0.0',
      category: ProfileCategory.REMOTE_DESKTOP,
      profileType: VNC_REMOTE_DESKTOP,
      defaultPort: 5900,
      icon: 'desktop_windows',
      enabled: true,
      secretTypes: ['PASSWORD_ONLY'],
      supportedAuthTypes: ['login', 'secret'],
    },
    profileFormComponent: VncProfileFormComponent,
    sessionComponent: VncComponent,
  });
}
