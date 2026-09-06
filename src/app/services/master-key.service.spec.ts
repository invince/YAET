import {MasterKeyService} from './master-key.service';
import {Profile, Profiles} from '../domain/profile/Profile';

describe('MasterKeyService.encrypt', () => {
  // Simulates the real Electron main-process boundary: ipc.invoke
  // structured-clones args (class prototypes incl. toJSON are dropped while
  // Maps survive as Maps), then the main handler JSON-stringifies objects.
  function mainBoundary(payload: any): string {
    const overIpc = structuredClone(payload);
    return typeof overIpc === 'string' ? overIpc : JSON.stringify(overIpc);
  }

  function createService(captured: { payload?: any }, encryptImpl?: (p: any) => Promise<any>) {
    const electronStub = {
      masterKeyExists: () => Promise.resolve(true),
      onMasterKeyChanged: () => () => {},
      encrypt: (p: any) => {
        captured.payload = p;
        return encryptImpl ? encryptImpl(p) : Promise.resolve('ciphertext');
      },
    };
    const logStub = { info: () => {} };
    return new MasterKeyService(logStub as any, electronStub as any);
  }

  function seedProfiles(): Profiles {
    const profiles = new Profiles();
    const p = new Profile();
    p.id = 'prof-1';
    p.name = 'Seed SSH';
    p.setProfile('SSH_TERMINAL', {
      host: '10.20.30.40', port: 22, authType: 'secret',
      login: '', password: '', secretId: 'seed-sec-001',
    });
    profiles.profiles = [p];
    return profiles;
  }

  it('pre-serializes Profiles so Map profileData survives the IPC boundary', async () => {
    // Regression: passing live Profile instances over IPC dropped toJSON, so
    // the main-process JSON.stringify turned profileData Maps into {} and
    // every re-encrypt/save wiped all profile credentials (secretId/login/
    // password). encrypt() must hand the main process a string instead.
    const captured: { payload?: any } = {};
    const service = createService(captured);

    await service.encrypt(seedProfiles());

    expect(typeof captured.payload).toBe('string');
    const roundTripped = JSON.parse(mainBoundary(captured.payload));
    const ssh = roundTripped.profiles[0].profileData['SSH_TERMINAL'];
    expect(ssh.host).toBe('10.20.30.40');
    expect(ssh.secretId).toBe('seed-sec-001');
    service.ngOnDestroy();
  });

  it('passes string payloads through unchanged', async () => {
    const captured: { payload?: any } = {};
    const service = createService(captured);

    await service.encrypt('{"a":1}');

    expect(captured.payload).toBe('{"a":1}');
    service.ngOnDestroy();
  });

  it('returns null when encryption fails', async () => {
    const captured: { payload?: any } = {};
    const service = createService(captured, () => Promise.reject(new Error('no key')));

    expect(await service.encrypt({})).toBeNull();
    service.ngOnDestroy();
  });
});
