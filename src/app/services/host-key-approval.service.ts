import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {
  HostKeyApprovalComponent,
  HostKeyChoice,
  HostKeyPromptData
} from '../components/dialog/host-key-approval/host-key-approval.component';
import {ElectronService} from './electron/electron.service';
import {LogService} from './log.service';
import {NotificationService} from './notification.service';

export interface HostKeySessionHooks {
  /** Re-send the session open, optionally with extra fields (e.g. trustOnce). */
  retry: (extra?: Record<string, unknown>) => void;
  /** Give up: close the tab that was waiting on approval. */
  abort: () => void;
}

/**
 * SSH host-key approval queue (A3).
 *
 * The main process verifies host keys fail-closed inside the ssh2 handshake
 * (hostVerifier is synchronous, so it cannot ask the user mid-handshake).
 * Unknown/changed keys therefore arrive here as `ssh.hostkey.prompt` events
 * carrying the full fingerprint + randomart; the user's choice resolves the
 * pending session:
 * - save → pin the key into known_hosts, then retry the open;
 * - once → retry with a one-shot in-memory trust (nothing written);
 * - cancel → abort (the waiting tab is closed).
 * One dialog at a time, FIFO — bursts don't stack dialogs.
 */
@Injectable({
  providedIn: 'root'
})
export class HostKeyApprovalService implements OnDestroy {

  private queue: HostKeyPromptData[] = [];
  private currentRef: MatDialogRef<HostKeyApprovalComponent> | null = null;
  private listening = false;
  private sessions = new Map<string, HostKeySessionHooks>();

  constructor(
    private electron: ElectronService,
    private dialog: MatDialog,
    private ngZone: NgZone,
    private log: LogService,
    private notification: NotificationService,
  ) { }

  ngOnDestroy(): void {
    this.electron.removeHostKeyPromptListeners();
  }

  ensureListening(): void {
    if (this.listening) return;
    this.listening = true;
    this.electron.onHostKeyPrompt((prompt) => {
      this.ngZone.run(() => this.enqueue(prompt));
    });
  }

  registerSession(sessionId: string, hooks: HostKeySessionHooks): void {
    this.sessions.set(sessionId, hooks);
  }

  unregisterSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private enqueue(prompt: HostKeyPromptData): void {
    if (!prompt || !prompt.id || !prompt.host || !prompt.base64) {
      this.log.warn('Host-key approval: ignoring malformed prompt');
      return;
    }
    this.queue.push(prompt);
    this.pump();
  }

  private pump(): void {
    if (this.currentRef || this.queue.length === 0) return;
    const prompt = this.queue.shift()!;
    this.currentRef = this.dialog.open(HostKeyApprovalComponent, {
      width: '560px',
      data: prompt,
      disableClose: true,
    });
    this.currentRef.afterClosed().subscribe((choice: HostKeyChoice | undefined) => {
      void this.settle(prompt, choice ?? 'cancel');
      this.currentRef = null;
      this.pump();
    });
  }

  private async settle(prompt: HostKeyPromptData, choice: HostKeyChoice): Promise<void> {
    const hooks = this.sessions.get(prompt.id);
    if (!hooks) {
      this.log.warn(`Host-key approval: no pending session for ${prompt.id}, choice dropped`);
      return;
    }
    try {
      if (choice === 'save') {
        await this.electron.addKnownHost({
          host: prompt.host,
          port: prompt.port,
          keyType: prompt.keyType,
          base64: prompt.base64,
        });
        hooks.retry();
      } else if (choice === 'once') {
        hooks.retry({ trustOnce: { keyType: prompt.keyType, base64: prompt.base64 } });
      } else {
        hooks.abort();
      }
    } catch (err) {
      this.log.warn('Host-key approval settle failed: ' + err);
      this.notification.error('Failed to save host key: ' + (err instanceof Error ? err.message : String(err)));
      hooks.abort();
    }
  }
}
