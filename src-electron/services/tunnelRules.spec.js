/**
 * Unit tests for tunnelRules.js (pure validation).
 * Run: node --test src-electron/services/tunnelRules.spec.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTunnelRule,
  isValidPort,
  isValidBindHost,
  isValidRemoteHost,
} = require('./tunnelRules');

describe('tunnelRules', () => {
  describe('isValidPort', () => {
    it('accepts 1-65535 integers', () => {
      assert.equal(isValidPort(1), true);
      assert.equal(isValidPort(22), true);
      assert.equal(isValidPort(65535), true);
    });
    it('rejects out-of-range, zero, non-integers and non-numbers', () => {
      assert.equal(isValidPort(0), false);
      assert.equal(isValidPort(65536), false);
      assert.equal(isValidPort(-1), false);
      assert.equal(isValidPort(3.5), false);
      assert.equal(isValidPort('22'), false);
      assert.equal(isValidPort(NaN), false);
      assert.equal(isValidPort(undefined), false);
    });
  });

  describe('isValidBindHost', () => {
    it('accepts loopback hosts and empty (default)', () => {
      assert.equal(isValidBindHost(''), true);
      assert.equal(isValidBindHost('127.0.0.1'), true);
      assert.equal(isValidBindHost('localhost'), true);
      assert.equal(isValidBindHost('::1'), true);
    });
    it('rejects LAN/wildcard binds', () => {
      assert.equal(isValidBindHost('0.0.0.0'), false);
      assert.equal(isValidBindHost('192.168.1.5'), false);
      assert.equal(isValidBindHost('::'), false);
    });
  });

  describe('isValidRemoteHost', () => {
    it('accepts hostnames and IPs', () => {
      assert.equal(isValidRemoteHost('db.internal'), true);
      assert.equal(isValidRemoteHost('10.0.0.5'), true);
      assert.equal(isValidRemoteHost('::1'), true);
    });
    it('rejects empty and whitespace-injected hosts', () => {
      assert.equal(isValidRemoteHost(''), false);
      assert.equal(isValidRemoteHost('a b'), false);
      assert.equal(isValidRemoteHost('x\ny'), false);
    });
  });

  describe('normalizeTunnelRule', () => {
    it('normalizes a valid local rule with defaults', () => {
      const { rule, error } = normalizeTunnelRule({
        id: 'r1', type: 'local', localPort: 13306, remoteHost: '127.0.0.1', remotePort: 3306,
      });
      assert.equal(error, undefined);
      assert.equal(rule.bindHost, '127.0.0.1');
      assert.equal(rule.enabled, true);
      assert.match(rule.name, /13306/);
    });

    it('normalizes a remote rule without remoteHost', () => {
      const { rule, error } = normalizeTunnelRule({
        id: 'r2', type: 'remote', localPort: 8000, remotePort: 8080,
      });
      assert.equal(error, undefined);
      assert.equal(rule.localPort, 8000);
      assert.equal(rule.remotePort, 8080);
    });

    it('normalizes a dynamic rule ignoring remote fields', () => {
      const { rule, error } = normalizeTunnelRule({ id: 'r3', type: 'dynamic', localPort: 1080 });
      assert.equal(error, undefined);
      assert.equal(rule.bindHost, '127.0.0.1');
    });

    it('rejects unknown types', () => {
      const { error } = normalizeTunnelRule({ type: 'wormhole', localPort: 1 });
      assert.match(error, /unknown tunnel type/);
    });

    it('rejects non-object input without throwing', () => {
      assert.match(normalizeTunnelRule(null).error, /must be an object/);
      assert.match(normalizeTunnelRule('x').error, /must be an object/);
    });

    it('rejects bad local ports', () => {
      const { error } = normalizeTunnelRule({ type: 'local', localPort: 70000, remoteHost: 'h', remotePort: 80 });
      assert.match(error, /localPort/);
    });

    it('rejects missing remoteHost for local rules', () => {
      const { error } = normalizeTunnelRule({ type: 'local', localPort: 8080, remoteHost: '', remotePort: 80 });
      assert.match(error, /remoteHost/);
    });

    it('rejects non-loopback bindHost', () => {
      const { error } = normalizeTunnelRule({
        type: 'local', bindHost: '0.0.0.0', localPort: 8080, remoteHost: 'h', remotePort: 80,
      });
      assert.match(error, /loopback/);
    });

    it('rejects bad remotePort for remote rules', () => {
      const { error } = normalizeTunnelRule({ type: 'remote', localPort: 8000, remotePort: 0 });
      assert.match(error, /remotePort/);
    });

    it('defaults remoteBind to loopback', () => {
      const { rule, error } = normalizeTunnelRule({ id: 'r', type: 'remote', localPort: 8000, remotePort: 8080 });
      assert.equal(error, undefined);
      assert.equal(rule.remoteBind, '127.0.0.1');
    });

    it('accepts 0.0.0.0 remoteBind for LAN exposure', () => {
      const { rule, error } = normalizeTunnelRule({
        id: 'r', type: 'remote', localPort: 8000, remotePort: 8080, remoteBind: '0.0.0.0',
      });
      assert.equal(error, undefined);
      assert.equal(rule.remoteBind, '0.0.0.0');
    });

    it('rejects arbitrary LAN IPs as remoteBind', () => {
      const { error } = normalizeTunnelRule({
        id: 'r', type: 'remote', localPort: 8000, remotePort: 8080, remoteBind: '192.168.1.5',
      });
      assert.match(error, /remoteBind/);
    });
  });
});
