import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {TunnelApprovalComponent, TunnelApprovalData} from '../components/dialog/tunnel-approval/tunnel-approval.component';
import {ElectronService} from './electron/electron.service';
import {LogService} from './log.service';

export interface TunnelApprovalRequest extends TunnelApprovalData {
  requestId: string;
}

/**
 * Incoming-connection approval queue for publicly-bound (-R 0.0.0.0)
 * tunnels. The main process holds the SSH channel until the user allows or
 * denies; unanswered requests are rejected there after a timeout.
 * One dialog at a time, FIFO — bursts don't stack dialogs.
 */
@Injectable({
  providedIn: 'root'
})
export class TunnelApprovalService implements OnDestroy {

  private queue: TunnelApprovalRequest[] = [];
  private currentRef: MatDialogRef<TunnelApprovalComponent> | null = null;
  private listening = false;

  constructor(
    private electron: ElectronService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private log: LogService,
  ) { }

  ngOnDestroy(): void {
    this.electron.removeTunnelApprovalRequestListeners();
  }

  ensureListening(): void {
    if (this.listening) return;
    this.listening = true;
    this.electron.onTunnelApprovalRequest((request) => {
      this.ngZone.run(() => this.enqueue(request));
    });
  }

  private enqueue(request: TunnelApprovalRequest): void {
    if (!request || !request.requestId) {
      this.log.warn('Tunnel approval: ignoring malformed request');
      return;
    }
    this.queue.push(request);
    this.pump();
  }

  private pump(): void {
    if (this.currentRef || this.queue.length === 0) return;
    const request = this.queue.shift()!;
    this.currentRef = this.dialog.open(TunnelApprovalComponent, {
      width: '440px',
      data: {
        tunnelId: request.tunnelId,
        tunnelName: request.tunnelName,
        srcIP: request.srcIP,
        srcPort: request.srcPort,
        dstPort: request.dstPort,
      } as TunnelApprovalData,
      disableClose: true,
    });
    this.currentRef.afterClosed().subscribe((choice: 'deny' | 'once' | 'trust' | undefined) => {
      try {
        this.electron.resolveTunnelApproval(
          request.requestId,
          choice === 'once' || choice === 'trust',
          choice === 'trust',
        );
      } catch (err) {
        this.log.warn('Tunnel approval resolve failed: ' + err);
      }
      this.currentRef = null;
      this.pump();
    });
  }
}
