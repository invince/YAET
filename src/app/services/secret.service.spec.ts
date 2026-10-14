import {Secret, Secrets, SecretType} from '../domain/Secret';
import {SECRETS_LOADED} from './electron/ElectronConstant';
import {SecretStorageService} from './secret-storage.service';
import {SecretService} from './secret.service';

describe('SecretService', () => {
  let service: SecretService;
  let electron: {
    onLoadedEvent: jasmine.Spy; saveSecrets: jasmine.Spy; reloadSecrets: jasmine.Spy;
  };
  let masterKey: { encrypt: jasmine.Spy; decrypt2String: jasmine.Spy };
  let storage: SecretStorageService;

  beforeEach(() => {
    electron = {
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
      saveSecrets: jasmine.createSpy('saveSecrets').and.callFake(async () => {}),
      reloadSecrets: jasmine.createSpy('reloadSecrets'),
    };
    masterKey = {
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (d: unknown) => 'enc:' + JSON.stringify(d).length),
      decrypt2String: jasmine.createSpy('decrypt2String').and.callFake(async () => null),
    };
    storage = new SecretStorageService();
    service = new SecretService(
      { warn: (_m: string) => {}, error: (_m: string) => {} } as never,
      electron as never,
      storage as never,
      { settings: { ui: { secretLabelLengthInDropDown: 8 } } } as never,
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
    expect(call.args[0]).toBe(SECRETS_LOADED);
    return call.args[1] as (data: unknown) => void;
  }

  it('starts not-loaded and subscribes to secrets.loaded', () => {
    expect(service.isLoaded).toBeFalse();
    expect(electron.onLoadedEvent).toHaveBeenCalled();
  });

  it('applies the payload and emits loaded$', async () => {
    masterKey.decrypt2String.and.callFake(async () =>
      JSON.stringify({ secrets: [{ id: 's1', name: 'n', secretType: 'LOGIN_PASSWORD' }] }));
    loadedCallback()('encrypted-blob');
    await tick();
    expect(service.isLoaded).toBeTrue();
    expect(storage.data.secrets.length).toBe(1);
    let loaded = false;
    service.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('reload resets loaded state and pokes main', () => {
    service.reload();
    expect(service.isLoaded).toBeFalse();
    expect(electron.reloadSecrets).toHaveBeenCalled();
  });

  it('saveAll stamps, fixes icons, encrypts and sends', async () => {
    const secrets = new Secrets();
    const one = new Secret();
    one.secretType = SecretType.SSH_KEY;
    one.isNew = true;
    secrets.secrets.push(one);
    await service.saveAll(secrets);
    expect(secrets.version).toBeTruthy();
    expect(secrets.compatibleVersion).toBeTruthy();
    expect(one.isNew).toBeFalse();
    expect(one.icon).toBe('key');
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(electron.saveSecrets).toHaveBeenCalled();
  });

  it('deleteOne/updateOne maintain the store', () => {
    storage.data = new Secrets();
    const one = new Secret();
    one.id = 'x';
    service.updateOne(one);
    expect(storage.data.secrets.length).toBe(1);
    service.deleteOne(one);
    expect(storage.data.secrets.length).toBe(0);
  });
});
