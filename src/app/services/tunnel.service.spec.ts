import {TunnelSnapshot} from '../domain/profile/TunnelRule';
import {Tunnels} from '../domain/profile/TunnelRule';
import {TunnelStorageService} from './tunnel-storage.service';
import {TunnelService} from './tunnel.service';
import {TUNNELS_LOADED} from './electron/ElectronConstant';

function makeSnapshot(partial: Partial<TunnelSnapshot> = {}): TunnelSnapshot {
  return {
    tunnelId: 't1', profileId: 'p1', profileName: 'srv', tunnelName: '',
    rule: {
      id: 't1', name: '', type: 'local', bindHost: '127.0.0.1',
      localPort: 13306, remoteHost: 'h', remotePort: 3306, enabled: true,
    },
    status: 'active', error: '', bytesUp: 0, bytesDown: 0,
    startedAt: Date.now(), actualLocalPort: 13306, reconnectAttempt: 0,
    ...partial,
  };
}

describe('TunnelService (renderer facade)', () => {
  let service: TunnelService;
  let electron: {
    listTunnels: jasmine.Spy; startTunnel: jasmine.Spy; stopTunnel: jasmine.Spy;
    stopAllTunnels: jasmine.Spy; onTunnelStatusChanged: jasmine.Spy;
    saveTunnels: jasmine.Spy; reloadTunnels: jasmine.Spy;
    onLoadedEvent: jasmine.Spy;
  };
  let masterKey: {
    encrypt: jasmine.Spy;
  };
  let storage: TunnelStorageService;

  beforeEach(() => {
    electron = {
      listTunnels: jasmine.createSpy('listTunnels').and.callFake(async () => []),
      startTunnel: jasmine.createSpy('startTunnel').and.callFake(async () => makeSnapshot()),
      stopTunnel: jasmine.createSpy('stopTunnel').and.callFake(async () => true),
      stopAllTunnels: jasmine.createSpy('stopAllTunnels').and.callFake(async () => {}),
      onTunnelStatusChanged: jasmine.createSpy('onTunnelStatusChanged'),
      saveTunnels: jasmine.createSpy('saveTunnels').and.callFake(async () => {}),
      reloadTunnels: jasmine.createSpy('reloadTunnels'),
      onLoadedEvent: jasmine.createSpy('onLoadedEvent'),
    };
    masterKey = {
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (data: unknown) => 'encrypted:' + JSON.stringify(data).length),
    };
    storage = new TunnelStorageService();
    const updateEvent$ = { subscribe: () => ({ unsubscribe: () => {} }) };
    service = new TunnelService(
      electron as never,
      { warn: (_msg: string) => {}, error: (_msg: string) => {} } as never,
      { run: (fn: () => void) => fn() } as never,
      { updateEvent$, encrypt: masterKey.encrypt, decrypt2String: async () => null } as never,
      { info: (_msg: string) => {}, error: (_msg: string) => {} } as never,
      storage as never,
      { isLoaded: true, loaded$: { subscribe: () => ({ unsubscribe: () => {} }) }, profilesCopy: { profiles: [] }, save: async () => {} } as never,
    );
  });

  function buildService(decryptResult: string | null): TunnelService {
    return new TunnelService(
      electron as never,
      { warn: (_msg: string) => {}, error: (_msg: string) => {} } as never,
      { run: (fn: () => void) => fn() } as never,
      {
        updateEvent$: { subscribe: () => ({ unsubscribe: () => {} }) },
        encrypt: masterKey.encrypt,
        decrypt2String: async () => decryptResult,
      } as never,
      { info: (_msg: string) => {}, error: (_msg: string) => {} } as never,
      new TunnelStorageService() as never,
      {
        isLoaded: true,
        loaded$: { subscribe: (fn: () => void) => { fn(); return { unsubscribe: () => {} }; } },
        profilesCopy: { profiles: [] },
        save: async () => {},
      } as never,
    );
  }

  function loadedCallback(): (data: unknown) => void {
    const call = electron.onLoadedEvent.calls.mostRecent();
    expect(call.args[0]).toBe(TUNNELS_LOADED);
    return call.args[1] as (data: unknown) => void;
  }

  it('ensureListening subscribes once and applies pushes', async () => {
    service.ensureListening();
    service.ensureListening();
    expect(electron.onTunnelStatusChanged).toHaveBeenCalledTimes(1);

    const cb = electron.onTunnelStatusChanged.calls.first().args[0] as (list: TunnelSnapshot[]) => void;
    cb([makeSnapshot()]);
    expect(service.statuses.length).toBe(1);
    expect(service.statusOf('t1')?.status).toBe('active');
    expect(service.statusOf('nope')).toBeUndefined();
  });

  it('refresh replaces statuses', async () => {
    electron.listTunnels.and.callFake(async () => [makeSnapshot()]);
    const list = await service.refresh();
    expect(list.length).toBe(1);
    expect(service.statuses.length).toBe(1);
  });

  it('start/stop/stopAll delegate and refresh', async () => {
    const snap = await service.start('t1');
    expect(electron.startTunnel).toHaveBeenCalledWith('t1');
    expect(snap.tunnelId).toBe('t1');

    const stopped = await service.stop('t1');
    expect(electron.stopTunnel).toHaveBeenCalledWith('t1');
    expect(stopped).toBeTrue();

    await service.stopAll();
    expect(electron.stopAllTunnels).toHaveBeenCalled();
  });

  it('saveAll versions, stores and encrypts', async () => {
    const tunnels = new Tunnels();
    await service.saveAll(tunnels);
    expect(tunnels.version).toBeTruthy();
    expect(tunnels.compatibleVersion).toBeTruthy();
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(electron.saveTunnels).toHaveBeenCalled();
    expect(service.tunnels).toBe(tunnels.tunnels);
  });

  it('saveOne upserts by id', async () => {
    const tunnel = {
      id: 'a', name: 'n', type: 'local', bindHost: '127.0.0.1',
      localPort: 1, remoteHost: 'h', remotePort: 2, enabled: true,
      connection: { mode: 'adhoc' },
    } as never;
    await service.saveOne(tunnel);
    expect(service.getTunnel('a')).toBeTruthy();
    await service.saveOne({ ...(tunnel as object), name: 'n2' } as never);
    expect(service.tunnels.length).toBe(1);
    expect(service.getTunnel('a')?.name).toBe('n2');
  });

  it('deleteOne removes the tunnel', async () => {
    const tunnel = {
      id: 'a', name: 'n', type: 'local', bindHost: '127.0.0.1',
      localPort: 1, remoteHost: 'h', remotePort: 2, enabled: true,
      connection: { mode: 'adhoc' },
    } as never;
    await service.saveOne(tunnel);
    await service.deleteOne('a');
    expect(service.tunnels.length).toBe(0);
    expect(electron.stopTunnel).toHaveBeenCalledWith('a');
  });

  it('reload resets loaded state and asks main to reload', () => {
    service.reload();
    expect(electron.reloadTunnels).toHaveBeenCalled();
  });

  it('applies the tunnels.loaded payload and emits loaded$', async () => {
    const svc = buildService(JSON.stringify({ tunnels: [{ id: 'a', name: 'n' }] }));
    expect(svc.isLoaded).toBeFalse();

    loadedCallback()(JSON.stringify({ tunnels: [{ id: 'a', name: 'n' }] }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(svc.isLoaded).toBeTrue();
    expect(svc.tunnels.length).toBe(1);
    expect(svc.getTunnel('a')?.name).toBe('n');
    let loaded = false;
    svc.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('reload emits loaded$ false and a later payload recovers', async () => {
    const svc = buildService(JSON.stringify({ tunnels: [{ id: 'a', name: 'n' }] }));
    const seen: boolean[] = [];
    svc.loaded$.subscribe(v => seen.push(v));

    loadedCallback()(JSON.stringify({ tunnels: [{ id: 'a', name: 'n' }] }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(svc.isLoaded).toBeTrue();

    svc.reload();
    expect(svc.isLoaded).toBeFalse();
    expect(seen[seen.length - 1]).toBeFalse();

    loadedCallback()(JSON.stringify({ tunnels: [{ id: 'a', name: 'n' }] }));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(svc.isLoaded).toBeTrue();
    expect(svc.tunnels.length).toBe(1);
    expect(seen[seen.length - 1]).toBeTrue();
  });

  it('empty decrypt payload stays not-loaded so a later reload retries', async () => {
    const svc = buildService(null);
    loadedCallback()('encrypted-payload');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(svc.isLoaded).toBeFalse();
    expect(svc.tunnels.length).toBe(0);
  });
});
