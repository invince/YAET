import {CloudSettings} from '../domain/setting/CloudSettings';
import {CLOUD_LOADED} from './electron/ElectronConstant';
import {CloudService} from './cloud.service';

describe('CloudService', () => {
  let service: CloudService;
  let electron: {
    onLoadedEvent: jasmine.Spy; saveCloud: jasmine.Spy; reloadCloud: jasmine.Spy;
    uploadCloud: jasmine.Spy; downloadCloud: jasmine.Spy; backupSettings: jasmine.Spy;
  };
  let masterKey: { encrypt: jasmine.Spy; decrypt2String: jasmine.Spy };

  beforeEach(() => {
    electron = {
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
      saveCloud: jasmine.createSpy('saveCloud').and.callFake(async () => {}),
      reloadCloud: jasmine.createSpy('reloadCloud'),
      uploadCloud: jasmine.createSpy('uploadCloud').and.callFake(async () => ({ succeed: true, ok: [], ko: [] })),
      downloadCloud: jasmine.createSpy('downloadCloud').and.callFake(async () => ({ succeed: true, ok: [], ko: [] })),
      backupSettings: jasmine.createSpy('backupSettings').and.callFake(async () => ({ succeed: true, ok: [], ko: [] })),
    };
    masterKey = {
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (d: unknown) => 'enc:' + JSON.stringify(d).length),
      decrypt2String: jasmine.createSpy('decrypt2String').and.callFake(async () => null),
    };
    service = new CloudService(
      {} as never,
      { warn: (_m: string) => {}, error: (_m: string) => {} } as never,
      electron as never,
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
    expect(call.args[0]).toBe(CLOUD_LOADED);
    return call.args[1] as (data: unknown) => void;
  }

  it('starts not-loaded and subscribes to cloud.loaded', () => {
    expect(service.isLoaded).toBeFalse();
    expect(electron.onLoadedEvent).toHaveBeenCalled();
  });

  it('applies the payload and emits loaded$', async () => {
    masterKey.decrypt2String.and.callFake(async () => JSON.stringify({ url: 'https://x', items: ['a'] }));
    loadedCallback()('encrypted-blob');
    await tick();
    expect(service.isLoaded).toBeTrue();
    expect(service.cloud.url).toBe('https://x');
    let loaded = false;
    service.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('reload resets loaded state and pokes main', () => {
    service.reload();
    expect(service.isLoaded).toBeFalse();
    expect(electron.reloadCloud).toHaveBeenCalled();
  });

  it('save stamps without revision, encrypts and sends', async () => {
    const cloud = new CloudSettings();
    await service.save(cloud);
    expect(cloud.version).toBeTruthy();
    expect(cloud.compatibleVersion).toBeTruthy();
    expect((cloud as unknown as { revision?: number }).revision).toBeUndefined();
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(electron.saveCloud).toHaveBeenCalled();
  });

  it('save with no data is a no-op', async () => {
    await service.save(undefined as never);
    expect(masterKey.encrypt).not.toHaveBeenCalled();
    expect(electron.saveCloud).not.toHaveBeenCalled();
  });

  it('upload/download/backup delegate to main', async () => {
    const cloud = new CloudSettings();
    await service.upload(cloud);
    await service.download(cloud);
    await service.backup(['a']);
    expect(electron.uploadCloud).toHaveBeenCalled();
    expect(electron.downloadCloud).toHaveBeenCalled();
    expect(electron.backupSettings).toHaveBeenCalledWith(['a']);
  });
});
