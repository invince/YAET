import {Injectable, Type} from '@angular/core';
import {ProfileCategory, ProfileType} from '../../domain/profile/Profile';
import {PluginFrontend} from '../../domain/plugin/plugin-manifest';

/**
 * External plugin registered via Web Component (Custom Element).
 * The profileFormElement is the tag name (e.g., 'demo-ssh-profile-form').
 */
export interface ExternalPluginInfo {
  id: string;
  name: string;
  category: ProfileCategory;
  profileType: ProfileType | string;
  profileFormElement: string; // custom element tag name
  ipcChannels?: { send: string[]; invoke: string[]; on: string[] };
}

/**
 * Central registry for frontend plugins.
 *
 * Each plugin registers its manifest + Angular components here.
 * The app uses this registry to:
 *   - Resolve which component to render for a given ProfileType
 *   - Resolve which profile form to show for a given ProfileType
 *   - Enumerate all installed plugins (for plugin manager UI)
 *
 * Usage:
 *   // In a plugin's registration function:
 *   registry.register({
 *     manifest: SSH_MANIFEST,
 *     profileFormComponent: SshProfileFormComponent,
 *     sessionComponent: TerminalComponent,
 *   });
 *
 *   // In app.component.ts:
 *   const plugin = registry.getPlugin(ProfileType.SSH_TERMINAL);
 *   const Component = plugin?.sessionComponent;
 */
@Injectable({providedIn: 'root'})
export class PluginRegistryService {
  private plugins = new Map<string, PluginFrontend>();
  private externalPlugins = new Map<string, ExternalPluginInfo>();

  /**
   * Register a plugin. Overwrites if the same id is already registered.
   */
  register(plugin: PluginFrontend): void {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  /**
   * Register an external plugin (loaded via Web Component).
   */
  registerExternalPlugin(info: ExternalPluginInfo): void {
    this.externalPlugins.set(info.id, info);
  }

  /**
   * Unregister a plugin by id.
   */
  unregister(id: string): void {
    this.plugins.delete(id);
    this.externalPlugins.delete(id);
  }

  /**
   * Get a plugin by its id.
   */
  getPluginById(id: string): PluginFrontend | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get a plugin by ProfileType.
   * This is the primary lookup used by the UI to resolve components.
   */
  getPlugin(profileType: ProfileType | string): PluginFrontend | undefined {
    return Array.from(this.plugins.values())
      .find(p => p.manifest.profileType === profileType);
  }

  /**
   * Get external plugin info by ProfileType.
   */
  getExternalPlugin(profileType: ProfileType | string): ExternalPluginInfo | undefined {
    return Array.from(this.externalPlugins.values())
      .find(p => p.profileType === profileType);
  }

  /**
   * Check if a profileType has an external plugin registered.
   */
  hasExternalPlugin(profileType: ProfileType | string): boolean {
    return this.getExternalPlugin(profileType) !== undefined;
  }

  /**
   * Get all external plugins for a given category.
   */
  getExternalPluginsByCategory(category: ProfileCategory): ExternalPluginInfo[] {
    return Array.from(this.externalPlugins.values())
      .filter(p => p.category === category);
  }

  /**
   * Get all plugins for a given category (TERMINAL, FILE_EXPLORER, etc.).
   */
  getPluginsByCategory(category: ProfileCategory): PluginFrontend[] {
    return Array.from(this.plugins.values())
      .filter(p => p.manifest.category === category && p.manifest.enabled);
  }

  /**
   * Get all registered plugins.
   */
  getAllPlugins(): PluginFrontend[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all enabled plugins.
   */
  getEnabledPlugins(): PluginFrontend[] {
    return Array.from(this.plugins.values())
      .filter(p => p.manifest.enabled);
  }

  /**
   * Check if a profileType has a registered plugin.
   */
  hasPlugin(profileType: ProfileType | string): boolean {
    return this.getPlugin(profileType) !== undefined;
  }

  /**
   * Get the session view component for a given ProfileType.
   * Returns null if no plugin is registered for that type.
   */
  getSessionComponent(profileType: ProfileType | string): Type<any> | null {
    return this.getPlugin(profileType)?.sessionComponent ?? null;
  }

  /**
   * Get the profile form component for a given ProfileType.
   * Returns null if no plugin is registered for that type.
   */
  getProfileFormComponent(profileType: ProfileType | string): Type<any> | null {
    return this.getPlugin(profileType)?.profileFormComponent ?? null;
  }
}
