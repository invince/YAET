const PLUGIN_ENTRIES: Record<string, (registry: any, injector: any) => void> = {};

export function registerPluginEntry(
  pluginId: string,
  registerFn: (registry: any, injector: any) => void,
): void {
  PLUGIN_ENTRIES[pluginId] = registerFn;
}

export function loadBundledPluginModule(pluginId: string): {register: Function} | null {
  const registerFn = PLUGIN_ENTRIES[pluginId];
  if (!registerFn) return null;
  return { register: registerFn };
}

export function getRegisteredPluginIds(): string[] {
  return Object.keys(PLUGIN_ENTRIES);
}
