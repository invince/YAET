import {TunnelRule, TunnelSnapshot, TunnelStatus} from '../../../domain/profile/TunnelRule';

/** Loopback-safe display helpers for tunnels (pure — no Angular/services). */

export type DisplayStatus = TunnelStatus | 'idle';

/** True when every inbound connection pops an approval dialog (public -R). */
export function needsConnectionApproval(rule: TunnelRule): boolean {
  return rule.type === 'remote' && rule.remoteBind === '0.0.0.0';
}

export function statusOfRule(snapshot: TunnelSnapshot | undefined): DisplayStatus {
  return snapshot?.status ?? 'idle';
}

export function isRuleRunning(snapshot: TunnelSnapshot | undefined): boolean {
  const status = statusOfRule(snapshot);
  return status === 'active' || status === 'starting' || status === 'reconnecting';
}

export function endpointSummary(rule: TunnelRule, actualLocalPort: number): string {
  const listenPort = actualLocalPort || rule.localPort || '?';
  if (rule.type === 'dynamic') {
    return `SOCKS5 ${rule.bindHost}:${listenPort}`;
  }
  if (rule.type === 'remote') {
    const serverBind = rule.remoteBind || '127.0.0.1';
    return `${serverBind}:${rule.remotePort} (server) → ${rule.bindHost}:${rule.localPort}`;
  }
  return `${rule.bindHost}:${listenPort} → ${rule.remoteHost}:${rule.remotePort}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function uptime(now: number, startedAt: number): string {
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export interface DirectionHint {
  key: string;
  params: Record<string, string | number>;
}

/**
 * One-line "which way does traffic flow" explanation for a rule.
 * Rendered live in the rule editor so the -L/-R direction is never a guess.
 */
export function directionHint(rule: TunnelRule, actualLocalPort: number): DirectionHint {
  const listenPort = actualLocalPort || rule.localPort || '?';
  if (rule.type === 'dynamic') {
    return {
      key: 'TUNNELS.DIR_DYNAMIC',
      params: { bind: rule.bindHost || '127.0.0.1', lport: listenPort },
    };
  }
  if (rule.type === 'remote') {
    return {
      key: 'TUNNELS.DIR_REMOTE',
      params: {
        rbind: rule.remoteBind || '127.0.0.1', rport: rule.remotePort || '?',
        bind: rule.bindHost || '127.0.0.1', lport: rule.localPort || '?',
      },
    };
  }
  return {
    key: 'TUNNELS.DIR_LOCAL',
    params: {
      bind: rule.bindHost || '127.0.0.1', lport: listenPort,
      rhost: rule.remoteHost || '?', rport: rule.remotePort || '?',
    },
  };
}
