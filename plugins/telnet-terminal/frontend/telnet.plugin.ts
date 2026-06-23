/**
 * Telnet Terminal Plugin - Frontend Registration
 */
import {inject} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/plugin/services/plugin-registry.service';
import {ProfileCategory, ProfileType} from '../../../src/app/domain/profile/Profile';

const TELNET_MANIFEST = {
  id: 'telnet-terminal',
  name: 'Telnet Terminal',
  version: '1.0.0',
  category: ProfileCategory.TERMINAL,
  profileType: ProfileType.TELNET_TERMINAL,
  defaultPort: 23,
  icon: 'terminal',
  enabled: true,
  secretTypes: ['LOGIN_PASSWORD'],
  supportedAuthTypes: ['N/A', 'login', 'secret'],
};

export function registerTelnetPlugin() {
  const registry = inject(PluginRegistryService);

  import('../../../src/app/components/terminal/terminal.component').then(({ TerminalComponent }) => {
    // Telnet uses the shared RemoteTerminalProfileFormComponent for profile editing
    import('../../../src/app/components/menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component').then(({ RemoteTerminalProfileFormComponent }) => {
      registry.register({
        manifest: TELNET_MANIFEST,
        profileFormComponent: RemoteTerminalProfileFormComponent,
        sessionComponent: TerminalComponent,
      });
    });
  });
}
