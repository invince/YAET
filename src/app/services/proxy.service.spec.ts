import {Proxies, Proxy} from '../domain/Proxy';
import {PROXIES_LOADED} from './electron/ElectronConstant';
import {ProxyStorageService} from './proxy-storage.service';
import {ProxyService} from './proxy.service';

describe('ProxyService', () => {
  let service: ProxyService;
  let electron: {
    onLoadedEvent: jasmine.Spy; saveProxies: jasmine.Spy; reloadProxies: jasmine.Spy;
  };
  let masterKey: { encrypt: jasmine.Spy; decrypt2String: jasmine.Spy };
  let storage: ProxyStorageService;

  beforeEach(() => {
    electron = {
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
      saveProxies: jasmine.createSpy('saveProxies').and.callFake(async () => {}),
      reloadProxies: jasmine.createSpy('reloadProxies'),
    };
    masterKey = {
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (d: unknown) => 'enc:' + JSON.stringify(d).length),
      decrypt2String: jasmine.createSpy('decrypt2String').and.callFake(async () => null),
    };
    storage = new ProxyStorageService();
    service = new ProxyService(
      { warn: (_m: string) => {}, error: (_m: string) => {} } as never,
      electron as never,
      storage as never,
      {
        updateEvent$: { subscribe: () => ({ unsubscribe: () => {} }) },
        encrypt: masterKey.encrypt,
        decrypt2String: masterKey.decrypt2String,
      } as never,
      { info: (_m: string) => {}, error: (_m: string) => {} } as never,
    );
  });

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  function loadedCallback(): (data: unknown) => void {
    const call = (electron.onLoadedEvent as jasmine.Spy).calls.mostRecent();
    expect(call.args[0]).toBe(PROXIES_LOADED);
    return call.args[1] as (data: unknown) => void;
  }

  it('starts not-loaded and subscribes to proxies.loaded', () => {
    expect(service.isLoaded).toBeFalse();
    expect(electron.onLoadedEvent).toHaveBeenCalled();
  });

  it('applies the payload and emits loaded$', async () => {
    masterKey.decrypt2String.and.callFake(async () =>
      JSON.stringify({ proxies: [{ id: 'p1', name: 'n', type: 'HTTP', host: 'h', port: 8080 }] }));
    loadedCallback()('encrypted-blob');
    await tick();
    expect(service.isLoaded).toBeTrue();
    expect(service.proxies.length).toBe(1);
    expect(service.findById('p1')?.name).toBe('n');
    let loaded = false;
    service.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('reload resets loaded state and pokes main', () => {
    service.reload();
    expect(service.isLoaded).toBeFalse();
    expect(electron.reloadProxies).toHaveBeenCalled();
  });

  it('saveAll stamps, clears isNew, encrypts and sends', async () => {
    const proxies = new Proxies();
    const proxy = new Proxy();
    proxy.isNew = true;
    proxies.proxies.push(proxy);
    await service.saveAll(proxies);
    expect(proxies.version).toBeTruthy();
    expect(proxies.compatibleVersion).toBeTruthy();
    expect(proxy.isNew).toBeFalse();
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(electron.saveProxies).toHaveBeenCalled();
  });

  it('deleteOne/updateOne/findById work on the store', () => {
    const proxy = new Proxy();
    proxy.id = 'x';
    service.updateOne(proxy);
    expect(service.findById('x')).toBeTruthy();
    const updated = new Proxy();
    updated.id = 'x';
    updated.name = 'renamed';
    service.updateOne(updated);
    expect(service.findById('x')?.name).toBe('renamed');
    service.deleteOne(updated);
    expect(service.findById('x')).toBeUndefined();
  });
});
