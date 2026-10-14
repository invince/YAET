import {StampedData, EncryptedConfigStoreService} from './config-store.service';

interface TestData extends StampedData {
  items: string[];
}

function blankData(): TestData {
  return { version: '', compatibleVersion: '', items: [] };
}

/** In-memory concrete store exercising every base-class path. */
class TestStore extends EncryptedConfigStoreService<TestData> {
  state: TestData | null = null;
  sent: string[] = [];
  reloadCalls = 0;
  postLoadCalls = 0;

  constructor(
    electron: never, log: never, notification: never, masterKey: never,
    snapshotProvider?: () => Promise<unknown>,
  ) {
    super(electron, log, notification, masterKey, {
      loadedEvent: 'test.loaded',
      storeLabel: 'tests',
      reload: () => { this.reloadCalls++; },
      snapshotProvider,
    });
  }

  protected override blank(): TestData { return blankData(); }
  protected override read(): TestData { return this.state as TestData; }
  protected override write(data: TestData): void { this.state = data; }
  protected override readonly compatVersion = '9.9.9-test';
  protected override readonly incompatibleMessage = 'INCOMPATIBLE tests';
  protected override readonly clearedMessage = 'Tests cleared';
  protected override saveToMain(encrypted: string): unknown { return this.sent.push(encrypted); }
  protected override postLoad(): void { this.postLoadCalls++; }
  protected override preSave(data: TestData): void { data.items.push('pre-saved'); }

  async saveAll(data?: TestData): Promise<void> { await this.persist(data); }
}

describe('EncryptedConfigStoreService', () => {
  let store: TestStore;
  let electron: { onLoadedEvent: jasmine.Spy };
  let log: { warn: jasmine.Spy; error: jasmine.Spy };
  let notification: { info: jasmine.Spy; error: jasmine.Spy };
  let masterKey: {
    updateEvent$: { subscribe: (obs: { next: (e: string) => void }) => { unsubscribe: () => void } };
    encrypt: jasmine.Spy;
    decrypt2String: jasmine.Spy;
  };
  let loadedCallback: (data: unknown) => void;
  let invalidCallback: (e: string) => void;

  function build(snapshotProvider?: () => Promise<unknown>): TestStore {
    electron = { onLoadedEvent: jasmine.createSpy('onLoadedEvent') };
    log = { warn: jasmine.createSpy('warn'), error: jasmine.createSpy('error') };
    notification = { info: jasmine.createSpy('info'), error: jasmine.createSpy('error') };
    masterKey = {
      updateEvent$: {
        subscribe: (obs: { next: (e: string) => void }) => {
          invalidCallback = obs.next;
          return { unsubscribe: () => {} };
        },
      },
      encrypt: jasmine.createSpy('encrypt').and.callFake(async (d: unknown) => 'enc:' + JSON.stringify(d).length),
      decrypt2String: jasmine.createSpy('decrypt2String').and.callFake(async () => null),
    };
    const s = new TestStore(
      electron as never, log as never, notification as never, masterKey as never,
      snapshotProvider,
    );
    loadedCallback = electron.onLoadedEvent.calls.mostRecent().args[1] as (data: unknown) => void;
    return s;
  }

  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(() => { store = build(); });

  it('subscribes to the configured loaded event', () => {
    expect(electron.onLoadedEvent.calls.mostRecent().args[0]).toBe('test.loaded');
    expect(store.isLoaded).toBeFalse();
  });

  it('apply(null) marks loaded with blank state and runs postLoad', async () => {
    loadedCallback(null);
    await tick();
    expect(store.isLoaded).toBeTrue();
    expect(store.postLoadCalls).toBe(1);
    let loaded = false;
    store.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeTrue();
  });

  it('apply(payload) decrypts, parses and stores', async () => {
    masterKey.decrypt2String.and.callFake(async () => JSON.stringify({ items: ['a'] }));
    loadedCallback('encrypted-blob');
    await tick();
    expect(store.isLoaded).toBeTrue();
    expect(store.state?.items).toEqual(['a']);
    expect(store.postLoadCalls).toBe(1);
  });

  it('incompatible compatibleVersion falls back to blank with a warning', async () => {
    masterKey.decrypt2String.and.callFake(async () => JSON.stringify({ compatibleVersion: '999.0.0', items: ['a'] }));
    loadedCallback('encrypted-blob');
    await tick();
    expect(store.isLoaded).toBeTrue();
    expect(store.state?.items).toEqual([]);
    expect(notification.info).toHaveBeenCalledWith('INCOMPATIBLE tests');
  });

  it('corrupt JSON falls back to blank with an error', async () => {
    masterKey.decrypt2String.and.callFake(async () => 'not-json{{{');
    loadedCallback('encrypted-blob');
    await tick();
    expect(store.isLoaded).toBeTrue();
    expect(store.state?.items).toEqual([]);
    expect(notification.error).toHaveBeenCalled();
  });

  it('empty decrypt stays not-loaded so a later reload retries', async () => {
    masterKey.decrypt2String.and.callFake(async () => null);
    loadedCallback('encrypted-blob');
    await tick();
    expect(store.isLoaded).toBeFalse();
    expect(log.warn).toHaveBeenCalled();
  });

  it('decrypt rejection is logged and stays not-loaded', async () => {
    masterKey.decrypt2String.and.callFake(async () => { throw new Error('locked'); });
    loadedCallback('encrypted-blob');
    await tick();
    expect(store.isLoaded).toBeFalse();
    expect(log.error).toHaveBeenCalled();
  });

  it("master-key 'invalid' clears, persists and notifies", async () => {
    store.state = { version: 'x', compatibleVersion: 'x', items: ['a'] };
    invalidCallback('invalid');
    await tick();
    expect(store.state?.items).toEqual(['pre-saved']);
    expect(store.sent.length).toBe(1);
    expect(notification.info).toHaveBeenCalledWith('Tests cleared');
  });

  it('persist stamps, runs preSave, encrypts and sends', async () => {
    await store.saveAll({ version: '', compatibleVersion: '', items: [] });
    expect(store.state?.version).toBeTruthy();
    expect(store.state?.compatibleVersion).toBe('9.9.9-test');
    expect(store.state?.revision).toBeGreaterThan(0);
    expect(store.state?.items).toEqual(['pre-saved']);
    expect(masterKey.encrypt).toHaveBeenCalled();
    expect(store.sent.length).toBe(1);
  });

  it('reload resets loaded state and pokes main', () => {
    store.reload();
    expect(store.isLoaded).toBeFalse();
    expect(store.reloadCalls).toBe(1);
    let loaded = true;
    store.loaded$.subscribe(v => { loaded = v; });
    expect(loaded).toBeFalse();
  });

  it('snapshotProvider fallback applies data missed by the one-shot push', async () => {
    const s = build(async () => 'encrypted-blob');
    // Runs before the ctor's promise chain reaches decrypt2String.
    masterKey.decrypt2String.and.callFake(async () => JSON.stringify({ items: ['late'] }));
    await tick();
    expect(s.isLoaded).toBeTrue();
    expect(s.state?.items).toEqual(['late']);
  });

  it('snapshotProvider rejection notifies and marks loaded with blank state', async () => {
    const s = build(async () => { throw new Error('gone'); });
    await tick();
    expect(notification.error).toHaveBeenCalled();
    expect(s.isLoaded).toBeTrue();
    expect(s.postLoadCalls).toBe(1);
  });
});
