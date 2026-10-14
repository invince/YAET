import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatDialog} from '@angular/material/dialog';
import {MatIcon} from '@angular/material/icon';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {Subscription} from 'rxjs';
import {ElectronService} from '../../../../services/electron/electron.service';
import {LogService} from '../../../../services/log.service';
import {NotificationService} from '../../../../services/notification.service';
import {ConfirmationComponent} from '../../../confirmation/confirmation.component';

export interface KnownHostEntry {
  host: string;
  port: number;
  keyType: string;
  base64: string;
  sha256: string;
  md5: string;
  randomart: string;
}

/**
 * known_hosts manager (A3): view pinned host keys, delete stale ones,
 * import an OpenSSH known_hosts file. Lives as a tab in the settings menu.
 */
@Component({
  selector: 'app-known-hosts',
  standalone: true,
  imports: [CommonModule, MatIcon, MatIconButton, MatButton, TranslateModule],
  templateUrl: './known-hosts.component.html',
  styleUrl: './known-hosts.component.scss'
})
export class KnownHostsComponent implements OnInit, OnDestroy {
  entries: KnownHostEntry[] = [];
  loading = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private electron: ElectronService,
    private notification: NotificationService,
    private log: LogService,
    private translate: TranslateService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      this.entries = await this.electron.listKnownHosts();
    } catch (err) {
      this.log.warn('known_hosts refresh failed: ' + err);
      this.notification.error(this.translate.instant('KNOWN_HOSTS.LOAD_FAIL'));
    } finally {
      this.loading = false;
    }
  }

  delete(entry: KnownHostEntry): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '400px',
      data: {
        message: this.translate.instant('KNOWN_HOSTS.DELETE_CONFIRM', { host: entry.host, port: entry.port }),
      },
    });
    this.subscriptions.push(dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (!confirmed) return;
      try {
        await this.electron.removeKnownHost({ host: entry.host, port: entry.port, keyType: entry.keyType });
        this.notification.success(this.translate.instant('KNOWN_HOSTS.DELETED'));
        await this.refresh();
      } catch (err) {
        this.log.warn('known_hosts delete failed: ' + err);
        this.notification.error(this.translate.instant('KNOWN_HOSTS.DELETE_FAIL'));
      }
    }));
  }

  async importFile(): Promise<void> {
    try {
      const result = await this.electron.importKnownHosts();
      if (!result || !result.file) return; // picker cancelled
      this.notification.success(this.translate.instant('KNOWN_HOSTS.IMPORTED', {
        added: result.added,
        skipped: result.skipped,
      }));
      await this.refresh();
    } catch (err) {
      this.log.warn('known_hosts import failed: ' + err);
      this.notification.error(this.translate.instant('KNOWN_HOSTS.IMPORT_FAIL'));
    }
  }
}
