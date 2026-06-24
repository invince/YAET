import {Injectable} from '@angular/core';
import {PluginRegistryService} from './plugin-registry.service';

declare const window: any;

/**
 * PluginLoaderService — Dynamically loads external plugin frontend bundles.
 *
 * External plugins ship a pre-built JS file (frontend/index.js) that:
 *   1. Registers Web Components via customElements.define()
 *   2. Exposes plugin metadata on window.__<PLUGIN_ID>_PLUGIN__
 *
 * This service:
 *   1. Reads the merged manifest to discover external plugins
 *   2. Reads each plugin's frontend JS via IPC (avoids CSP file:// restriction)
 *   3. Injects it as an inline <script> to execute in the renderer
 *   4. Registers the plugin in the PluginRegistryService
 */
@Injectable({providedIn: 'root'})
export class PluginLoaderService {
  private loadedPlugins = new Set<string>();

  constructor(
    private registry: PluginRegistryService,
  ) {}

  /**
   * Load all external plugin frontends.
   * Call this once at app startup.
   */
  async loadExternalPlugins(): Promise<void> {
    const manifest = await this.readMergedManifest();
    if (!manifest) return;

    for (const [id, plugin] of Object.entries(manifest.plugins as Record<string, any>)) {
      if (this.loadedPlugins.has(id)) continue;

      if (plugin.source === 'external') {
        try {
          const code = await window.electronAPI.invoke('plugins.readFrontend', id);
          if (!code) {
            console.warn(`[PluginLoader] No frontend code for plugin ${id}`);
            continue;
          }
          this.executePluginCode(id, code);
          this.registerPluginFromWindow(id, plugin);
          this.loadedPlugins.add(id);
          console.log(`[PluginLoader] Loaded external plugin: ${id}`);
        } catch (err) {
          console.error(`[PluginLoader] Failed to load plugin ${id}:`, err);
        }
      } else if (plugin.source === 'bundled' && plugin.ipcChannels) {
        if (plugin.category === 'TERMINAL' || plugin.category === 'REMOTE_DESKTOP' || plugin.category === 'FILE_EXPLORER') {
          this.registry.registerBundledPlugin({
            id,
            name: plugin.name,
            category: plugin.category,
            profileType: plugin.profileType,
            profileFormElement: '',
            ipcChannels: plugin.ipcChannels,
            frontendEntry: plugin.frontendEntry || '',
          });
          this.loadedPlugins.add(id);
          console.log(`[PluginLoader] Registered bundled plugin: ${id}`);
        }
      }
    }
  }

  private async readMergedManifest(): Promise<any> {
    try {
      return await window.electronAPI.invoke('plugins.getMergedManifest');
    } catch {
      return null;
    }
  }

  /**
   * Execute plugin frontend code as an inline script.
   * This avoids CSP restrictions on file:// URLs.
   */
  private executePluginCode(pluginId: string, code: string): void {
    const script = document.createElement('script');
    script.textContent = code;
    document.head.appendChild(script);
    // Clean up the script element after execution
    script.remove();
  }

  /**
   * After loading the bundle, read the metadata from window.__<ID>_PLUGIN__
   * and register it with the PluginRegistryService.
   */
  private registerPluginFromWindow(pluginId: string, manifestEntry: any): void {
    const globalKey = `__${pluginId.toUpperCase().replace(/-/g, '_')}_PLUGIN__`;
    const pluginMeta = (window as any)[globalKey];

    if (!pluginMeta) {
      console.warn(`[PluginLoader] Plugin ${pluginId} did not expose metadata at window.${globalKey}`);
      return;
    }

    this.registry.registerExternalPlugin({
      id: pluginId,
      name: pluginMeta.manifest.name,
      category: pluginMeta.manifest.category,
      profileType: pluginMeta.manifest.profileType,
      profileFormElement: pluginMeta.profileFormElement,
      ipcChannels: manifestEntry.ipcChannels,
    });
  }
}
