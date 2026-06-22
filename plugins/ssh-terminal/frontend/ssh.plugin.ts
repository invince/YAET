/**
 * SSH Terminal Plugin - Frontend Registration
 *
 * Registers the SSH terminal plugin with the PluginRegistryService.
 * This is the entry point for the frontend plugin system.
 */
import {inject} from '@angular/core';
import {PluginRegistryService} from '../../../src/app/services/plugin/plugin-registry.service';
import {ProfileCategory, ProfileType} from '../../../src/app/domain/profile/Profile';

// SSH Plugin metadata — mirrors manifest.json
const SSH_MANIFEST = {
  id: 'ssh-terminal',
  name: 'SSH Terminal',
  version: '1.0.0',
  category: ProfileCategory.TERMINAL,
  profileType: ProfileType.SSH_TERMINAL,
  defaultPort: 22,
  icon: 'terminal',
  enabled: true,
  secretTypes: ['LOGIN_PASSWORD', 'SSH_KEY'],
  supportedAuthTypes: ['N/A', 'login', 'secret'],
};

/**
 * Register the SSH plugin.
 * Called from a central plugin bootstrap (e.g., app init or plugin loader).
 *
 * The sessionComponent points to the shared TerminalComponent since
 * SSH, Telnet, Local, and WinRM all use the same xterm.js-based UI.
 */
export function registerSshPlugin() {
  const registry = inject(PluginRegistryService);

  // Lazy import to avoid circular dependencies
  import('./ssh-profile-form.component').then(({ SshProfileFormComponent }) => {
    import('../../../src/app/components/terminal/terminal.component').then(({ TerminalComponent }) => {
      registry.register({
        manifest: SSH_MANIFEST,
        profileFormComponent: SshProfileFormComponent,
        sessionComponent: TerminalComponent,
      });
    });
  });
}
