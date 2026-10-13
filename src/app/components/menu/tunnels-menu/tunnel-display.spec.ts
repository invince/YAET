import {TunnelRule, TunnelSnapshot} from '../../../domain/profile/TunnelRule';
import {directionHint, endpointSummary, formatBytes, isRuleRunning, needsConnectionApproval, statusOfRule, uptime} from './tunnel-display';

function makeRule(partial: Partial<TunnelRule> = {}): TunnelRule {
  return {
    id: 'r1', name: 'db', type: 'local', bindHost: '127.0.0.1',
    localPort: 13306, remoteHost: 'db.internal', remotePort: 3306, enabled: true,
    ...partial,
  };
}

function makeSnapshot(partial: Partial<TunnelSnapshot> = {}): TunnelSnapshot {
  return {
    tunnelId: 'r1', profileId: 'p1', profileName: 'srv', tunnelName: '', rule: makeRule(),
    status: 'active', error: '', bytesUp: 0, bytesDown: 0,
    startedAt: Date.now(), actualLocalPort: 13306, reconnectAttempt: 0,
    ...partial,
  };
}

describe('tunnel-display (pure helpers)', () => {
  it('statusOfRule defaults to idle', () => {
    expect(statusOfRule(undefined)).toBe('idle');
    expect(statusOfRule(makeSnapshot({ status: 'error' }))).toBe('error');
  });

  it('isRuleRunning covers active/starting/reconnecting', () => {
    expect(isRuleRunning(undefined)).toBeFalse();
    expect(isRuleRunning(makeSnapshot({ status: 'active' }))).toBeTrue();
    expect(isRuleRunning(makeSnapshot({ status: 'starting' }))).toBeTrue();
    expect(isRuleRunning(makeSnapshot({ status: 'reconnecting' }))).toBeTrue();
    expect(isRuleRunning(makeSnapshot({ status: 'stopped' }))).toBeFalse();
    expect(isRuleRunning(makeSnapshot({ status: 'error' }))).toBeFalse();
  });

  it('endpointSummary renders all three types', () => {
    expect(endpointSummary(makeRule(), 13306)).toBe('127.0.0.1:13306 → db.internal:3306');
    expect(endpointSummary(makeRule({ type: 'dynamic', localPort: 1080 }), 1080))
      .toBe('SOCKS5 127.0.0.1:1080');
    expect(endpointSummary(makeRule({ type: 'remote', localPort: 8000, remotePort: 8080 }), 0))
      .toBe('127.0.0.1:8080 (server) → 127.0.0.1:8000');
  });

  it('endpointSummary shows the public server bind', () => {
    expect(endpointSummary(makeRule({ type: 'remote', localPort: 8000, remotePort: 8080, remoteBind: '0.0.0.0' }), 0))
      .toBe('0.0.0.0:8080 (server) → 127.0.0.1:8000');
  });

  it('needsConnectionApproval only for public remote binds', () => {
    expect(needsConnectionApproval(makeRule())).toBeFalse();
    expect(needsConnectionApproval(makeRule({ type: 'dynamic' }))).toBeFalse();
    expect(needsConnectionApproval(makeRule({ type: 'remote' }))).toBeFalse();
    expect(needsConnectionApproval(makeRule({ type: 'remote', remoteBind: '0.0.0.0' }))).toBeTrue();
  });

  it('endpointSummary prefers the actual (auto-picked) port', () => {
    expect(endpointSummary(makeRule({ localPort: 0 }), 45678)).toBe('127.0.0.1:45678 → db.internal:3306');
  });

  it('formatBytes uses B/KB/MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('uptime formats s/m/h', () => {
    const now = Date.now();
    expect(uptime(now, now - 30 * 1000)).toBe('30s');
    expect(uptime(now, now - 5 * 60 * 1000)).toBe('5m');
    expect(uptime(now, now - 90 * 60 * 1000)).toBe('1h 30m');
  });

  it('directionHint explains all three types with concrete ports', () => {
    expect(directionHint(makeRule(), 13306)).toEqual({
      key: 'TUNNELS.DIR_LOCAL',
      params: { bind: '127.0.0.1', lport: 13306, rhost: 'db.internal', rport: 3306 },
    });
    expect(directionHint(makeRule({ type: 'remote', localPort: 8000, remotePort: 8080 }), 0)).toEqual({
      key: 'TUNNELS.DIR_REMOTE',
      params: { rbind: '127.0.0.1', rport: 8080, bind: '127.0.0.1', lport: 8000 },
    });
    expect(directionHint(makeRule({ type: 'dynamic', localPort: 1080 }), 1080)).toEqual({
      key: 'TUNNELS.DIR_DYNAMIC',
      params: { bind: '127.0.0.1', lport: 1080 },
    });
  });
});
