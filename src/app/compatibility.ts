/**
 * Config schema versions used for compatibility checks when loading saved
 * JSON (settings / profiles / secrets / proxies / cloud).
 *
 * Lives in its own module (NOT in main.ts): main.ts bootstraps AppComponent,
 * so importing Compatibility from main.ts creates a module-evaluation cycle
 * (service → main → app.component → cloud.service → ProfileService, TDZ
 * crash) that breaks unit-test bundles depending on import order.
 */
export class Compatibility {

  static settings = '1.0.0';
  static cloud = '1.0.0';
  static secrets = '1.0.0';
  static profiles = '1.0.0';
  static proxies = '2.0.0';
  static tunnels = '1.0.0';
}
