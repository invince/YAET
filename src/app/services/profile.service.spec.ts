import {Profile, Profiles} from '../domain/profile/Profile';
import {PROFILES_LOADED} from './electron/ElectronConstant';
import {ProfileService} from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let electron: {
    onLoadedEvent: jasmine.Spy; saveProfiles: jasmine.Spy; reloadProfiles: jasmine.Spy;
  };
  let masterKey: { encrypt: jasmine.Spy; decrypt2String: jasmine.Spy };

  beforeEach(() => {
    electron = {
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
      saveProfiles: jasmine.createSpy('saveProfiles').and.callFake(async () => {}),
      reloadProfiles: jasmine.createSpy('reloadProfiles'),
    };
    masterKey = {
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (d: unknown) => 'enc:' + JSON.stringify(d).length),
      decrypt2String: jasmine.createSpy('decrypt2String').and.callFake(async () => null),
    };
    service = new ProfileService(
      { warn: (_m: string) => {}, error: (_m: string) => {} } as never,
      electron as never,
      {
        updateEvent$: { subscribe: () => ({ unsubscribe: () => {} }) },
        encrypt: masterKey.encrypt,
        decrypt2String: masterKey.decrypt2String,
      } as never,
      { info: (_m: string) => {}, error: (_m: string) => {} } as never,
      { getProfileIcon: (_t: string) => 'icon-mock' } as never,
    );
  });

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  function loadedCallback(): (data: unknown) => void {
    const call = (electron.onLoadedEvent as jasmine.Spy).calls.mostRecent();
    expect(call.args[0]).toBe(PROFILES_LOADED);
    return call.args[1] as (data: unknown) => void;
  }

  it('starts not-loaded and subscribes to profiles.loaded', () => {
    expect(service.isLoaded).toBeFalse();
    expect(electron.onLoadedEvent).toHaveBeenCalled();
  });

  it('applies the payload, deserializes profiles and emits loaded$', async () => {
    masterKey.decrypt2String.and.callFake(async () =>
      JSON.stringify({ profiles: [{ id: 'p1', name: 'n', profileType: 'SSH_TERMINAL' }] }));
    loadedCallback()('encrypted-blob');
    await tick();
    expect(service.isLoaded).toBeTrue();
    expect(service.profiles.profiles.length).toBe(1);
    expect(service.profiles.profiles[0] instanceof Profile).toBeTrue();
    let loaded = false;
    service.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('reload resets loaded state and pokes main', () => {
    service.reload();
    expect(service.isLoaded).toBeFalse();
    expect(electron.reloadProfiles).toHaveBeenCalled();
  });

  it('save stamps, clears isNew, resolves icons, encrypts and sends', async () => {
    const profiles = new Profiles();
    const one = new Profile();
    one.isNew = true;
    profiles.profiles.push(one);
    await service.save(profiles);
    expect(profiles.version).toBeTruthy();
    expect(profiles.compatibleVersion).toBeTruthy();
    expect(one.isNew).toBeFalse();
    expect(one.icon).toBe('icon-mock');
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(electron.saveProfiles).toHaveBeenCalled();
  });
});
