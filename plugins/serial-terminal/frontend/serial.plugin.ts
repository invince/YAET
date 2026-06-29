import {Injector} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory} from '../../../src/app/domain/profile/Profile';
import {SerialProfileFormComponent} from './serial-profile-form.component';

export const SERIAL_TERMINAL = 'SERIAL_TERMINAL';

export function register(registry: PluginRegistryService, _injector: Injector) {
  registry.registerCategoryType(ProfileCategory.TERMINAL, SERIAL_TERMINAL, 'PROFILES.SERIAL_TERMINAL', 'settings_input_hdmi');
  registry.registerFormMetadata(SERIAL_TERMINAL, 'serialProfileForm', SERIAL_TERMINAL);

  registry.register({
    manifest: {
      id: 'serial-terminal',
      name: 'Serial Port',
      version: '1.0.0',
      category: ProfileCategory.TERMINAL,
      profileType: SERIAL_TERMINAL,
      icon: 'settings_input_hdmi',
      enabled: true,
      secretTypes: [],
      supportedAuthTypes: ['N/A']
    },
    profileFormComponent: SerialProfileFormComponent,
    sessionComponent: null as any,
  });
}
