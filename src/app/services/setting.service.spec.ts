import {MySettings} from '../domain/setting/MySettings';
import {SETTINGS_LOADED} from './electron/ElectronConstant';
import {SettingStorageService} from './setting-storage.service';
import {SettingService} from './setting.service';

describe('SettingService', () => {
  let electron: {
    onLoadedEvent: jasmine.Spy; getSettings: jasmine.Spy;
    saveSetting: jasmine.Spy; reloadSettings: jasmine.Spy;
  };
  let storage: SettingStorageService;

  function build(snapshot: unknown = null): SettingService {
    electron = {
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
      getSettings: jasmine.createSpy('getSettings').and.callFake(async () => snapshot),
      saveSetting: jasmine.createSpy('saveSetting'),
      reloadSettings: jasmine.createSpy('reloadSettings'),
    };
    storage = new SettingStorageService();
    return new SettingService(
      { warn: (_m: string) => {}, error: (_m: string) => {}, info: (_m: string) => {} } as never,
      electron as never,
      storage as never,
      {} as never,
      { info: (_m: string) => {}, error: (_m: string) => {} } as never,
    );
  }

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  it('subscribes to settings.loaded and stays not-loaded without data', async () => {
    const service = build(null);
    await tick();
    expect(electron.onLoadedEvent.calls.mostRecent().args[0]).toBe(SETTINGS_LOADED);
    expect(service.isLoaded).toBeFalse();
  });

  it('startup fallback applies a missed snapshot', async () => {
    const service = build({ terminal: {}, fileExplorer: {}, remoteDesktop: {}, ai: {} });
    await tick();
    expect(service.isLoaded).toBeTrue();
    let loaded = false;
    service.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('applies the pushed payload and emits settingLoadedEvent', async () => {
    const service = build(null);
    await tick();
    let eventFired = false;
    service.settingLoadedEvent.subscribe(() => { eventFired = true; });
    const cb = (electron.onLoadedEvent as jasmine.Spy).calls.mostRecent().args[1] as (d: unknown) => void;
    cb(JSON.stringify({ terminal: {}, fileExplorer: {}, remoteDesktop: {}, ai: {} }));
    expect(service.isLoaded).toBeTrue();
    expect(eventFired).toBeTrue();
  });

  it('incompatible payload falls back to defaults', async () => {
    const service = build(null);
    await tick();
    const cb = (electron.onLoadedEvent as jasmine.Spy).calls.mostRecent().args[1] as (d: unknown) => void;
    cb(JSON.stringify({ compatibleVersion: '999.0.0' }));
    expect(service.isLoaded).toBeTrue();
    expect(storage.settings instanceof MySettings).toBeTrue();
  });

  it('save stamps and sends', () => {
    const service = build(null);
    const settings = new MySettings();
    service.save(settings);
    expect(settings.version).toBeTruthy();
    expect(settings.compatibleVersion).toBeTruthy();
    expect(electron.saveSetting).toHaveBeenCalled();
  });

  it('reload resets loaded state and pokes main', async () => {
    const service = build({ terminal: {}, fileExplorer: {}, remoteDesktop: {}, ai: {} });
    await tick();
    expect(service.isLoaded).toBeTrue();
    service.reload();
    expect(service.isLoaded).toBeFalse();
    expect(electron.reloadSettings).toHaveBeenCalled();
  });
});
