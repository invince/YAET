import {CommonModule} from '@angular/common';
import {Component, NgZone, OnDestroy, OnInit} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {TranslateModule} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {newTunnel, Tunnel, TunnelSnapshot, TunnelStatus} from '../../../domain/profile/TunnelRule';
import {needsConnectionApproval} from './tunnel-display';
import {endpointSummary as endpointSummaryOf} from './tunnel-display';import {NotificationService} from '../../../services/notification.service';
import {TunnelService} from '../../../services/tunnel.service';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {EmptyStateComponent} from '../../empty-state/empty-state.component';
import {TunnelFormComponent} from '../../dialog/tunnel-form/tunnel-form.component';
import {MenuComponent} from '../menu.component';

export interface TunnelRow {
  tunnel: Tunnel;
  snapshot?: TunnelSnapshot;
}

@Component({
  selector: 'app-tunnels-menu',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIcon,
    MatTooltipModule,
    TranslateModule,
    EmptyStateComponent,
  ],
  templateUrl: './tunnels-menu.component.html',
  styleUrl: './tunnels-menu.component.scss'
})
export class TunnelsMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  rows: TunnelRow[] = [];
  now = Date.now();

  private subscriptions: Subscription[] = [];
  private clock: ReturnType<typeof setInterval> | null = null;

  constructor(
    public tunnelService: TunnelService,
    private notification: NotificationService,
    private dialog: MatDialog,
    private ngZone: NgZone,
  ) {
    super();
  }

  ngOnInit(): void {
    this.tunnelService.ensureListening();
    this.rebuildRows();
    this.subscriptions.push(
      this.tunnelService.statuses$.subscribe(() => this.ngZone.run(() => this.rebuildRows()))
    );
    this.clock = setInterval(() => {
      this.now = Date.now();
    }, 5000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(one => one.unsubscribe());
    if (this.clock !== null) {
      clearInterval(this.clock);
      this.clock = null;
    }
  }

  rebuildRows(): void {
    const statuses = new Map(this.tunnelService.statuses.map(s => [s.tunnelId, s]));
    this.rows = this.tunnelService.tunnels
      .filter(t => t && t.id)
      .map(tunnel => ({ tunnel, snapshot: statuses.get(tunnel.id) }));
  }

  get hasActive(): boolean {
    return this.rows.some(r => r.snapshot && (r.snapshot.status === 'active' || r.snapshot.status === 'starting' || r.snapshot.status === 'reconnecting'));
  }

  statusOf(row: TunnelRow): TunnelStatus | 'idle' {
    return row.snapshot?.status ?? 'idle';
  }

  isRunning(row: TunnelRow): boolean {
    const status = this.statusOf(row);
    return status === 'active' || status === 'starting' || status === 'reconnecting';
  }

  isPublic(row: TunnelRow): boolean {
    return needsConnectionApproval(row.tunnel);
  }

  endpointSummary(row: TunnelRow): string {
    return endpointSummaryOf(row.tunnel, row.snapshot?.actualLocalPort ?? 0);
  }

  connectionSummary(row: TunnelRow): string {
    const conn = row.tunnel.connection;
    if (!conn || conn.mode === 'profile') {
      return row.snapshot?.profileName || '';
    }
    return `${conn.host || ''}:${conn.port || 22}`;
  }

  uptime(row: TunnelRow): string {
    if (!row.snapshot?.startedAt || this.statusOf(row) === 'stopped' || this.statusOf(row) === 'error') return '';
    const seconds = Math.max(0, Math.floor((this.now - row.snapshot!.startedAt) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  async toggle(row: TunnelRow): Promise<void> {
    try {
      if (this.isRunning(row)) {
        await this.tunnelService.stop(row.tunnel.id);
      } else {
        await this.tunnelService.start(row.tunnel.id);
      }
    } catch (err) {
      this.notification.error(this.describeError(err));
    }
    this.rebuildRows();
  }

  addTunnel(): void {
    const ref = this.dialog.open(TunnelFormComponent, {
      width: '560px',
      data: { tunnel: newTunnel(), isNew: true },
    });
    this.subscriptions.push(ref.afterClosed().subscribe(async (tunnel: Tunnel | null) => {
      if (!tunnel) return;
      try {
        await this.tunnelService.saveOne(tunnel);
      } catch (err) {
        this.notification.error(this.describeError(err));
      }
      this.rebuildRows();
    }));
  }

  editTunnel(row: TunnelRow): void {
    const ref = this.dialog.open(TunnelFormComponent, {
      width: '560px',
      data: { tunnel: row.tunnel, isNew: false },
    });
    this.subscriptions.push(ref.afterClosed().subscribe(async (tunnel: Tunnel | null) => {
      if (!tunnel) return;
      try {
        await this.tunnelService.saveOne(tunnel);
      } catch (err) {
        this.notification.error(this.describeError(err));
      }
      this.rebuildRows();
    }));
  }

  deleteTunnel(row: TunnelRow): void {
    const ref = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: `Delete tunnel '${row.tunnel.name || row.tunnel.id}'?` },
    });
    this.subscriptions.push(ref.afterClosed().subscribe(async (confirmed: boolean) => {
      if (!confirmed) return;
      try {
        await this.tunnelService.deleteOne(row.tunnel.id);
      } catch (err) {
        this.notification.error(this.describeError(err));
      }
      this.rebuildRows();
    }));
  }

  async stopAll(): Promise<void> {
    try {
      await this.tunnelService.stopAll();
    } catch (err) {
      this.notification.error(this.describeError(err));
    }
    this.rebuildRows();
  }

  async refresh(): Promise<void> {
    try {
      await this.tunnelService.refresh();
    } catch (err) {
      this.notification.error(this.describeError(err));
    }
    this.rebuildRows();
  }

  private describeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
