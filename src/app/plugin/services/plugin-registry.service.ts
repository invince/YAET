import {Injectable, Type} from '@angular/core';
import {CUSTOM_PROFILE, LOCAL_TERMINAL, Profile, ProfileCategory, ProfileType} from '../../domain/profile/Profile';
import {PluginFrontend} from '../plugin-manifest';
import {Session} from '../../domain/session/Session';

export interface ExternalPluginInfo {
  id: string;
  name: string;
  category: ProfileCategory;
  profileType: ProfileType | string;
  profileFormElement: string;
  ipcChannels?: { send: string[]; invoke: string[]; on: string[] };
}

export interface BundledPluginInfo extends ExternalPluginInfo {
  sessionFactory?: (profile: Profile, profileType: ProfileType) => Session;
  formControlName?: string;
  profileField?: string;
  frontendEntry?: string;
}

export interface ProfileTypeInfo {
  profileType: string;
  translationKey: string;
  icon: string;
}

/**
 * Central registry for frontend plugins.
 *
 * Also holds the dynamic ProfileCategoryTypeMap — plugins register their
 * profile types here, and the UI reads them to populate dropdowns.
 */
@Injectable({providedIn: 'root'})
export class PluginRegistryService {
  private plugins = new Map<string, PluginFrontend>();
  private externalPlugins = new Map<string, ExternalPluginInfo>();
  private bundledPlugins = new Map<string, BundledPluginInfo>();

  /** category → ordered list of profile type info */
  private categoryTypeMap = new Map<ProfileCategory, ProfileTypeInfo[]>();

  constructor() {
    // Register core profile types
    this.registerCategoryType(ProfileCategory.TERMINAL, LOCAL_TERMINAL, 'PROFILES.LOCAL_TERMINAL', 'terminal');
    this.registerCategoryType(ProfileCategory.CUSTOM, CUSTOM_PROFILE, 'PROFILES.CUSTOM', 'star');
  }

  // ─── Category Type Map ────────────────────────────────────────────

  /** Register a profile type for a category. Called by plugins during register(). */
  registerCategoryType(category: ProfileCategory, profileType: string, translationKey: string, icon: string = 'terminal'): void {
    const list = this.categoryTypeMap.get(category) || [];
    if (!list.find(t => t.profileType === profileType)) {
      list.push({profileType, translationKey, icon});
    }
    this.categoryTypeMap.set(category, list);
  }

  /** Get all profile types for a category. */
  getCategoryTypes(category: ProfileCategory): ProfileTypeInfo[] {
    return this.categoryTypeMap.get(category) || [];
  }

  /** Get all profile types across all categories. */
  getAllCategoryTypes(): Map<ProfileCategory, ProfileTypeInfo[]> {
    return this.categoryTypeMap;
  }

  /** Get translation key for a profile type. */
  getProfileTypeTranslationKey(profileType: string): string {
    for (const list of this.categoryTypeMap.values()) {
      const found = list.find(t => t.profileType === profileType);
      if (found) return found.translationKey;
    }
    return profileType;
  }

  /** Get default icon for a profile type. */
  getProfileIcon(profileType: string): string {
    for (const list of this.categoryTypeMap.values()) {
      const found = list.find(t => t.profileType === profileType);
      if (found) return found.icon;
    }
    return 'terminal';
  }

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
   * Register a bundled plugin (has backend, optionally custom frontend session).
   */
  registerBundledPlugin(info: BundledPluginInfo): void {
    this.bundledPlugins.set(info.id, info);
  }

  /**
   * Get all bundled plugins with frontend entries.
   * Used by SessionService to dynamically import plugin registration modules.
   */
  getBundledPluginsWithEntries(): BundledPluginInfo[] {
    return Array.from(this.bundledPlugins.values())
      .filter(p => p.frontendEntry);
  }

  /**
   * Get a bundled plugin by ProfileType.
   */
  getBundledPlugin(profileType: ProfileType | string): BundledPluginInfo | undefined {
    return Array.from(this.bundledPlugins.values())
      .find(p => p.profileType === profileType);
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

  /**
   * Get form metadata (formControlName + profileField) for a given ProfileType.
   * Used by ProfileFormComponent to dynamically resolve form bindings.
   */
  getFormMetadata(profileType: ProfileType | string): { formControlName: string; profileField: string } | null {
    const plugin = this.getBundledPlugin(profileType);
    if (plugin?.formControlName && plugin?.profileField) {
      return { formControlName: plugin.formControlName, profileField: plugin.profileField };
    }
    return null;
  }
}
