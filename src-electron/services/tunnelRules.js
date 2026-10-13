/**
 * Tunnel rule validation — pure functions, no Electron dependencies.
 * Unit tested with node:test (`node --test src-electron/services/tunnelRules.spec.js`).
 *
 * A rule describes one SSH port forwarding, stored on the profile:
 *   profile.profileData.SSH_TERMINAL.tunnels[] = TunnelRule
 *
 * Field semantics per type (mirrors ssh -L/-R/-D):
 * - local   (-L [bindHost:]localPort:remoteHost:remotePort):
 *           listen locally, forward to remoteHost:remotePort as seen from the server.
 * - remote  (-R [remoteBind:]remotePort:localHost:localPort):
 *           the SERVER listens on remoteBind:remotePort, forwards back to
 *           bindHost:localPort on this machine. remoteHost is unused.
 *           remoteBind defaults to loopback; '0.0.0.0' exposes the port to the
 *           server's LAN (requires the server's GatewayPorts yes, and every
 *           incoming connection then needs user approval).
 * - dynamic (-D [bindHost:]localPort):
 *           local SOCKS5 proxy on bindHost:localPort. remoteHost/remotePort unused.
 *
 * Security: local listeners are loopback-only in v1. Binding 0.0.0.0 would
 * expose the user's machine to the LAN, so non-loopback bindHost is rejected.
 */

const TUNNEL_TYPES = ['local', 'remote', 'dynamic'];

/** Hosts we allow a LOCAL listener to bind. '' means "use the default". */
const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1']);

const DEFAULT_BIND_HOST = '127.0.0.1';
/** Default server-side bind for -R forwards. */
const DEFAULT_REMOTE_BIND = '127.0.0.1';
/**
 * Allowed server-side binds for -R. Tight on purpose: loopback, or 0.0.0.0
 * for LAN exposure (which additionally gates every incoming connection
 * behind user approval). Arbitrary LAN IPs add no value over 0.0.0.0.
 */
const REMOTE_BIND_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1', '0.0.0.0']);
/** True when the server-side listener is reachable beyond the server itself. */
const PUBLIC_BINDS = new Set(['0.0.0.0']);

function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isValidBindHost(host) {
  return typeof host === 'string' && LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

function isValidRemoteHost(host) {
  // Hostname, IPv4, or bracketed/unbracketed IPv6 — keep it loose, the SSH
  // server does the real resolution. Just reject empty / whitespace-injected.
  return typeof host === 'string' && host.length > 0 && host.length <= 253 && !/[\s\x00-\x1f]/.test(host);
}

function defaultRuleName(rule) {
  if (rule.name && rule.name.trim()) return rule.name.trim();
  if (rule.type === 'dynamic') return `dynamic ${rule.localPort}`;
  if (rule.type === 'remote') return `remote ${rule.remotePort} → ${rule.localPort}`;
  return `local ${rule.localPort} → ${rule.remoteHost}:${rule.remotePort}`;
}

/**
 * Validate + normalize a raw rule object.
 * @returns {{rule: object}|{error: string}} — never throws.
 */
function normalizeTunnelRule(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'tunnel rule must be an object' };

  const type = raw.type;
  if (!TUNNEL_TYPES.includes(type)) {
    return { error: `unknown tunnel type '${type}' (expected one of ${TUNNEL_TYPES.join(', ')})` };
  }

  const rule = {
    id: raw.id || '',
    name: '',
    type,
    bindHost: DEFAULT_BIND_HOST,
    localPort: Number(raw.localPort) || 0,
    remoteHost: typeof raw.remoteHost === 'string' ? raw.remoteHost.trim() : '',
    remotePort: Number(raw.remotePort) || 0,
    remoteBind: DEFAULT_REMOTE_BIND,
    enabled: raw.enabled !== false,
  };

  if (raw.bindHost !== undefined && raw.bindHost !== null && String(raw.bindHost) !== '') {
    if (!isValidBindHost(String(raw.bindHost))) {
      return { error: `bindHost '${raw.bindHost}' is not allowed — local listeners must stay on loopback (127.0.0.1, localhost or ::1)` };
    }
    rule.bindHost = String(raw.bindHost).trim().toLowerCase();
  }

  // localPort 0 means "pick an ephemeral port" — allowed for local/dynamic
  // listeners. A remote (-R) target of port 0 is meaningless, and the server
  // side can never usefully listen on 0, so remote requires real ports.
  const allowEphemeralLocal = type !== 'remote';
  if (rule.localPort !== 0 || !allowEphemeralLocal) {
    if (!isValidPort(rule.localPort)) {
      return { error: `localPort '${raw.localPort}' is invalid — expected an integer 1-65535${allowEphemeralLocal ? ' (or 0 to auto-pick)' : ''}` };
    }
  }

  if (type === 'local') {
    if (!isValidRemoteHost(rule.remoteHost)) {
      return { error: `remoteHost '${raw.remoteHost}' is invalid — expected a hostname or IP address as seen from the SSH server` };
    }
    if (!isValidPort(rule.remotePort)) {
      return { error: `remotePort '${raw.remotePort}' is invalid — expected an integer 1-65535` };
    }
  } else if (type === 'remote') {
    // bindHost doubles as the LOCAL target host for -R.
    if (!isValidPort(rule.remotePort)) {
      return { error: `remotePort '${raw.remotePort}' is invalid — expected an integer 1-65535 (the port the server will listen on)` };
    }
    if (raw.remoteBind !== undefined && raw.remoteBind !== null && String(raw.remoteBind) !== '') {
      const bind = String(raw.remoteBind).trim().toLowerCase();
      if (!REMOTE_BIND_HOSTS.has(bind)) {
        return { error: `remoteBind '${raw.remoteBind}' is not allowed — use 127.0.0.1 (server-local only) or 0.0.0.0 (server LAN, every connection needs approval)` };
      }
      rule.remoteBind = bind;
    }
  }
  // dynamic needs nothing else.

  rule.name = defaultRuleName(rule);
  return { rule };
}

module.exports = {
  TUNNEL_TYPES,
  DEFAULT_BIND_HOST,
  DEFAULT_REMOTE_BIND,
  REMOTE_BIND_HOSTS,
  PUBLIC_BINDS,
  isValidPort,
  isValidBindHost,
  isValidRemoteHost,
  normalizeTunnelRule,
};
