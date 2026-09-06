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
 *   3. Executes it via blob URL (CSP-safe, no unsafe-inline needed)
 *   4. Registers the plugin in the PluginRegistryService
 */
@Injectable({providedIn: 'root'})
export class PluginLoaderService {
  private loadedPlugins = new Set<string>();
  private blobUrls: string[] = [];

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
          // Execute the plugin code and WAIT until the <script> actually runs
          // (its onload fires after the module sets window.__<ID>_PLUGIN__).
          // Without awaiting, registerPluginFromWindow runs too early and the
          // global isn't set yet -> plugin is silently never registered.
          await this.executePluginCode(id, code);
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
            openNewTab: plugin.openNewTab,
            ipcChannels: plugin.ipcChannels,
            frontendEntry: plugin.frontendEntry || '',
          });
          this.loadedPlugins.add(id);
          console.log(`[PluginLoader] Registered bundled plugin: ${id}`);
        }
      }
    }
  }

  /**
   * Reload external plugins:
   *   1. Tells the backend to rescan and reload external plugins
   *   2. Clears the loaded set so frontend code is re-evaluated
   *   3. Re-reads the merged manifest and reloads frontends
   */
  async reloadExternalPlugins(): Promise<void> {
    await window.electronAPI.invoke('plugins.reloadExternal');
    this.revokeBlobUrls();
    this.loadedPlugins.clear();
    await this.loadExternalPlugins();
  }

  private async readMergedManifest(): Promise<any> {
    try {
      return await window.electronAPI.invoke('plugins.getMergedManifest');
    } catch {
      return null;
    }
  }

  /**
   * Execute plugin frontend code via blob URL (CSP-safe).
   * Avoids the need for 'unsafe-inline' in script-src.
   * Returns a Promise that resolves once the <script> has actually loaded and
   * executed (so callers can then read window.__<ID>_PLUGIN__ safely).
   */
  private executePluginCode(pluginId: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const blob = new Blob([code], {type: 'application/javascript'});
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrls.push(blobUrl);

      const script = document.createElement('script');
      script.src = blobUrl;
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        console.error(`[PluginLoader] Failed to execute plugin ${pluginId}`);
        script.remove();
        reject(new Error(`Failed to execute plugin ${pluginId}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Revoke all blob URLs to free memory.
   */
  private revokeBlobUrls(): void {
    for (const url of this.blobUrls) {
      try { URL.revokeObjectURL(url); } catch {}
    }
    this.blobUrls = [];
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
      sessionElement: pluginMeta.sessionElement,
      ipcChannels: manifestEntry.ipcChannels,
      supportedAuthTypes: pluginMeta.manifest.supportedAuthTypes,
      secretTypes: pluginMeta.manifest.secretTypes,
    });
  }
}
