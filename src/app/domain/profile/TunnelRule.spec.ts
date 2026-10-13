import {migrateLegacyTunnels, newTunnel, newTunnelRule, TunnelRule, validateTunnelRule} from './TunnelRule';

describe('validateTunnelRule (renderer mirror of tunnelRules.js)', () => {
  it('accepts a valid local rule', () => {
    expect(validateTunnelRule(newTunnelRule({
      type: 'local', localPort: 13306, remoteHost: '127.0.0.1', remotePort: 3306,
    }))).toBeNull();
  });

  it('accepts localPort 0 as auto-pick for local/dynamic', () => {
    expect(validateTunnelRule(newTunnelRule({ type: 'local', localPort: 0, remoteHost: 'h', remotePort: 80 }))).toBeNull();
    expect(validateTunnelRule(newTunnelRule({ type: 'dynamic', localPort: 0 }))).toBeNull();
  });

  it('rejects missing remoteHost for local rules', () => {
    expect(validateTunnelRule(newTunnelRule({ type: 'local', localPort: 8080, remoteHost: '', remotePort: 80 })))
      .toBe('TUNNELS.ERROR_BAD_REMOTE_HOST');
  });

  it('rejects non-loopback bindHost', () => {
    expect(validateTunnelRule(newTunnelRule({
      type: 'local', bindHost: '0.0.0.0', localPort: 8080, remoteHost: 'h', remotePort: 80,
    }))).toBe('TUNNELS.ERROR_BAD_BIND');
  });

  it('requires real ports for remote rules', () => {
    expect(validateTunnelRule(newTunnelRule({ type: 'remote', localPort: 0, remotePort: 8080 })))
      .toBe('TUNNELS.ERROR_BAD_LOCAL_PORT');
    expect(validateTunnelRule(newTunnelRule({ type: 'remote', localPort: 8000, remotePort: 0 })))
      .toBe('TUNNELS.ERROR_BAD_REMOTE_PORT');
  });

  it('newTunnelRule generates unique ids with loopback default', () => {
    const a = newTunnelRule();
    const b = newTunnelRule();
    expect(a.id).not.toBe(b.id);
    expect(a.bindHost).toBe('127.0.0.1');
    expect(a.enabled).toBeTrue();
  });
});

describe('newTunnel', () => {
  it('defaults to profile mode with a fresh id', () => {
    const t = newTunnel({ name: 'db', type: 'local', localPort: 13306, remoteHost: 'h', remotePort: 3306 });
    expect(t.id).toBeTruthy();
    expect(t.connection).toEqual({ mode: 'profile' });
    expect(t.name).toBe('db');
  });
});

describe('migrateLegacyTunnels', () => {
  function sshProfile(id: string, tunnels: unknown): { id: string; profileType: string; getProfile: (t: string) => { tunnels?: TunnelRule[] } | undefined } {
    return { id, profileType: 'SSH_TERMINAL', getProfile: (t: string) => t === 'SSH_TERMINAL' ? { tunnels: tunnels as TunnelRule[] } : undefined };
  }

  it('moves embedded rules to profile-bound tunnels keeping ids', () => {
    const moved = migrateLegacyTunnels([
      sshProfile('p1', [{ id: 'r1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2 }]),
    ]);
    expect(moved.length).toBe(1);
    expect(moved[0].id).toBe('r1');
    expect(moved[0].connection).toEqual({ mode: 'profile', profileId: 'p1' });
    expect(moved[0].localPort).toBe(1);
  });

  it('skips non-SSH profiles and malformed entries', () => {
    const moved = migrateLegacyTunnels([
      { id: 't1', profileType: 'TELNET_TERMINAL', getProfile: (_t: string) => ({ tunnels: [{ id: 'x' }] as TunnelRule[] }) },
      sshProfile('p1', [null, 'nope', { id: 'r1', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2 }]),
      sshProfile('p2', undefined),
    ]);
    expect(moved.length).toBe(1);
    expect(moved[0].id).toBe('r1');
  });

  it('regenerates colliding ids', () => {
    const moved = migrateLegacyTunnels([
      sshProfile('p1', [{ id: 'dup', type: 'local', localPort: 1, remoteHost: 'h', remotePort: 2 }]),
      sshProfile('p2', [{ id: 'dup', type: 'local', localPort: 3, remoteHost: 'h', remotePort: 4 }]),
    ]);
    expect(moved.length).toBe(2);
    expect(moved[0].id).toBe('dup');
    expect(moved[1].id).not.toBe('dup');
  });
});
