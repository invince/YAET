import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory, ProfileType} from '../../../src/app/domain/profile/Profile';
import {TabService} from '../../../src/app/services/tab.service';
import {VncService} from './services/vnc.service';
import {NgxSpinnerService} from 'ngx-spinner';
import {NotificationService} from '../../../src/app/services/notification.service';
import {VncPluginSession} from './vnc-plugin-session';
import {VncComponent} from './main/vnc.component';
import {VncProfileFormComponent} from './form/vnc-profile-form.component';

export function registerVncPlugin(
  registry: PluginRegistryService,
  tabService: TabService,
  vncService: VncService,
  spinner: NgxSpinnerService,
  notification: NotificationService,
) {
  const bundledPlugin = registry.getBundledPlugin(ProfileType.VNC_REMOTE_DESKTOP);
  if (bundledPlugin) {
    bundledPlugin.sessionFactory = (profile, profileType) =>
      new VncPluginSession(profile, profileType, tabService, vncService, spinner, notification);
    bundledPlugin.formControlName = 'vncProfileForm';
    bundledPlugin.profileField = 'vncProfile';
  }

  registry.register({
    manifest: {
      id: 'vnc-remote-desktop',
      name: 'VNC Remote Desktop',
      version: '1.0.0',
      category: ProfileCategory.REMOTE_DESKTOP,
      profileType: ProfileType.VNC_REMOTE_DESKTOP,
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
