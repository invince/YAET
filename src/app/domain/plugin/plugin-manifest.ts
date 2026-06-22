import {Type} from '@angular/core';
import {ProfileCategory, ProfileType} from '../profile/Profile';

/**
 * IPC channel declarations for a plugin.
 * These are used to dynamically build the preload.js whitelist.
 */
export interface PluginIpcChannels {
  send?: string[];
  invoke?: string[];
  on?: string[];
}

/**
 * Plugin manifest — mirrors the manifest.json in each plugin directory.
 * Describes what the plugin provides and what IPC channels it uses.
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category: ProfileCategory;
  profileType: ProfileType;
  defaultPort?: number;
  icon: string;
  enabled: boolean;
  dependencies?: string[];
  ipc?: PluginIpcChannels;
  backend?: string;
  frontend?: {
    profileForm?: string;
    sessionView?: string;
    plugin?: string;
  };
  secretTypes?: string[];
  supportedAuthTypes?: string[];
}

/**
 * Frontend plugin descriptor — registered with PluginRegistryService.
 * Contains the manifest plus the actual Angular component references.
 */
export interface PluginFrontend {
  manifest: PluginManifest;

  /** Angular component for the profile creation/editing form */
  profileFormComponent: Type<any>;

  /** Angular component for the session view (terminal, file explorer, etc.) */
  sessionComponent: Type<any>;

  /** Optional: additional Angular providers (services) this plugin needs */
  providers?: any[];
}

/**
 * Backend plugin descriptor — used internally by PluginManager.
 */
export interface PluginBackend {
  manifest: PluginManifest;
  loaded: boolean;
  module?: any;
}
