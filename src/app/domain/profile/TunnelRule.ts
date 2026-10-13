/**
 * One SSH port-forwarding rule, stored on the profile:
 *   profile.profileData.SSH_TERMINAL.tunnels: TunnelRule[]
 *
 * Field semantics per type (mirrors ssh -L/-R/-D):
 * - local:   listen on bindHost:localPort locally,
 *            forward to remoteHost:remotePort as seen from the server.
 * - remote:  the SERVER listens on remotePort and forwards back to
 *            bindHost:localPort on this machine. remoteHost is unused.
 * - dynamic: local SOCKS5 proxy on bindHost:localPort.
 *            remoteHost/remotePort are unused.
 */
export type TunnelType = 'local' | 'remote' | 'dynamic';

export interface TunnelRule {
  id: string;
  name: string;
  type: TunnelType;
  /** Local listen/target host. Loopback only. */
  bindHost: string;
  /** Local listen port (local/dynamic) or local target port (remote). 0 = auto-pick (local/dynamic only). */
  localPort: number;
  /** Target host as seen from the SSH server (local only). */
  remoteHost: string;
  /** Target port (local) or server listen port (remote). */
  remotePort: number;
  /** Server-side listen address (remote only): loopback (default) or 0.0.0.0 (LAN, per-connection approval). */
  remoteBind?: string;
  enabled: boolean;
}

export const TUNNEL_TYPES: TunnelType[] = ['local', 'remote', 'dynamic'];

export const DEFAULT_BIND_HOST = '127.0.0.1';
export const DEFAULT_REMOTE_BIND = '127.0.0.1';
/** Server-side binds a -R rule may use: loopback, or 0.0.0.0 for LAN exposure. */
export const REMOTE_BIND_OPTIONS = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];

const LOOPBACK_HOSTS = new Set(['', '127.0.0.1', 'localhost', '::1']);

function isValidPortNumber(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validate a tunnel rule's forwarding parameters. Mirrors
 * src-electron/services/tunnelRules.js (the main process re-validates
 * authoritatively — this is only for immediate form feedback).
 * @returns i18n error key, or null when valid.
 */
export function validateTunnelRule(rule: TunnelRule): string | null {
  if (!TUNNEL_TYPES.includes(rule.type)) return 'TUNNELS.ERROR_BAD_TYPE';
  if (!LOOPBACK_HOSTS.has((rule.bindHost || '').trim().toLowerCase())) return 'TUNNELS.ERROR_BAD_BIND';
  if (rule.type === 'remote') {
    if (!isValidPortNumber(rule.localPort)) return 'TUNNELS.ERROR_BAD_LOCAL_PORT';
    if (!isValidPortNumber(rule.remotePort)) return 'TUNNELS.ERROR_BAD_REMOTE_PORT';
    const bind = (rule.remoteBind || '').trim().toLowerCase();
    if (bind !== '' && bind !== '127.0.0.1' && bind !== 'localhost' && bind !== '::1' && bind !== '0.0.0.0') {
      return 'TUNNELS.ERROR_BAD_REMOTE_BIND';
    }
    return null;
  }
  if (rule.localPort !== 0 && !isValidPortNumber(rule.localPort)) return 'TUNNELS.ERROR_BAD_LOCAL_PORT';
  if (rule.type === 'local') {
    if (!rule.remoteHost || !rule.remoteHost.trim()) return 'TUNNELS.ERROR_BAD_REMOTE_HOST';
    if (!isValidPortNumber(rule.remotePort)) return 'TUNNELS.ERROR_BAD_REMOTE_PORT';
  }
  return null;
}

let tunnelRuleCounter = 0;

export function newTunnelRule(partial: Partial<TunnelRule> = {}): TunnelRule {
  tunnelRuleCounter += 1;
  return {
    id: `tunnel-${Date.now().toString(36)}-${tunnelRuleCounter}`,
    name: '',
    type: 'local',
    bindHost: DEFAULT_BIND_HOST,
    localPort: 0,
    remoteHost: '',
    remotePort: 0,
    remoteBind: DEFAULT_REMOTE_BIND,
    enabled: true,
    ...partial,
  };
}

/** How a tunnel reaches its SSH server. */
export type TunnelConnectionMode = 'profile' | 'adhoc';

export interface TunnelConnection {
  mode: TunnelConnectionMode;
  /** mode 'profile': id of an existing SSH_TERMINAL profile. */
  profileId?: string;
  /** mode 'adhoc': host/port + credentials below. */
  host?: string;
  port?: number;
  authType?: 'login' | 'secret';
  login?: string;
  /** Inline password (encrypted at rest in tunnels.json, same as profiles). */
  password?: string;
  /** Reference into secrets.json. */
  secretId?: string;
  /** Optional proxy (proxies.json id). */
  proxyId?: string;
}

/** A first-class tunnel: forwarding params + how to reach the SSH server. */
export interface Tunnel extends TunnelRule {
  connection: TunnelConnection;
}

export function newTunnel(partial: Partial<Tunnel> = {}): Tunnel {
  const { connection, ...rest } = partial;
  return {
    ...newTunnelRule(rest),
    connection: { mode: 'profile', ...(connection ?? {}) },
  };
}

export class Tunnels {
  revision: number = Date.now();
  tunnels: Tunnel[] = [];
  version: string = '';
  compatibleVersion: string = '';
}

/**
 * One-way migration of legacy profile-embedded rules
 * (profile.profileData.SSH_TERMINAL.tunnels[]) into first-class tunnels
 * bound to their owning profile. Pure — unit tested.
 *
 * @returns moved tunnels; profiles are NOT mutated (caller clears + saves).
 */
export function migrateLegacyTunnels(
  profiles: { id: string; profileType: string; getProfile?: (type: string) => { tunnels?: TunnelRule[] } | undefined }[],
  takenIds: Set<string> = new Set(),
): Tunnel[] {
  const moved: Tunnel[] = [];
  for (const profile of profiles) {
    if (profile.profileType !== 'SSH_TERMINAL') continue;
    const embedded = profile.getProfile?.('SSH_TERMINAL')?.tunnels;
    if (!Array.isArray(embedded)) continue;
    for (const rule of embedded) {
      if (!rule || typeof rule !== 'object') continue;
      const candidate = (rule as TunnelRule).id;
      // NOTE: strip the original id before generating — newTunnelRule
      // spreads its argument over the fresh id.
      const { id: _ignored, ...forward } = rule as TunnelRule;
      const fresh = newTunnelRule(forward);
      moved.push({
        ...fresh,
        // Keep the original rule id when free so anything referencing it
        // (e.g. an already-running tunnel entry) stays stable.
        id: candidate && !takenIds.has(candidate) ? candidate : fresh.id,
        connection: { mode: 'profile', profileId: profile.id },
      });
      takenIds.add(moved[moved.length - 1].id);
    }
  }
  return moved;
}

/** Live status of a tunnel, as reported by the main process. */
export type TunnelStatus = 'starting' | 'active' | 'reconnecting' | 'error' | 'stopped';

export interface TunnelSnapshot {
  tunnelId: string;
  profileId: string;
  profileName: string;
  tunnelName: string;
  rule: TunnelRule;
  status: TunnelStatus;
  error: string;
  bytesUp: number;
  bytesDown: number;
  startedAt: number;
  actualLocalPort: number;
  reconnectAttempt: number;
}
