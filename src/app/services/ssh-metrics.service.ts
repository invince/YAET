import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {SettingStorageService} from './setting-storage.service';
import {TabService} from './tab.service';

export interface SshMetrics {
  cpu: number | null;
  mem: number | null;
  disk: number | null;
}

const POLL_INTERVAL_MS = 3000;

/**
 * Polls CPU/RAM/disk usage for the currently selected SSH tab and exposes the
 * latest sample. The backend answers over the tab's existing SSH connection,
 * so each poll is one small command — negligible overhead.
 */
@Injectable({
  providedIn: 'root',
})
export class SshMetricsService {
  private readonly metricsSubject = new BehaviorSubject<SshMetrics | null>(null);
  readonly metrics$: Observable<SshMetrics | null> = this.metricsSubject.asObservable();

  private readonly timer: ReturnType<typeof setInterval>;
  private inFlight = false;
  private currentTabId: string | null = null;

  constructor(
    private tabService: TabService,
    private settingStorage: SettingStorageService,
  ) {
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  private async poll(): Promise<void> {
    // Opt-in from Settings → UI → Bottom Bar. Hidden until enabled.
    if (!this.settingStorage.settings?.ui?.showSshMetrics) {
      this.currentTabId = null;
      this.metricsSubject.next(null);
      return;
    }

    const tab = this.tabService.getSelectedTab();
    // Do NOT trust tab.connected: a host-key retry path reconnects via
    // PluginSession.reopen() without re-running open(), so the flag can stay
    // false on a perfectly live session. The backend registry is the source
    // of truth and returns ok:false when the session really is gone.
    const isSsh = !!tab && tab.session?.profileType === 'SSH_TERMINAL';

    if (!isSsh) {
      this.currentTabId = null;
      this.metricsSubject.next(null);
      return;
    }

    const tabId = tab!.id;
    if (this.currentTabId !== tabId) {
      this.currentTabId = tabId;
      this.metricsSubject.next(null);
    }

    // Never stack requests: a slow remote must not queue up polls.
    if (this.inFlight) return;

    const ipc = (window as any).electronAPI;
    if (!ipc) {
      this.metricsSubject.next(null);
      return;
    }

    this.inFlight = true;
    try {
      const response = await ipc.invoke('session.metrics.ssh', { id: tabId });
      // Tab may have switched while the request was in flight.
      if (this.currentTabId !== tabId) return;
      if (response && response.ok) {
        // A successful probe proves the SSH session is alive — heal a stale
        // disconnected flag (e.g. after the host-key approve/retry flow).
        this.tabService.connected(tabId);
        this.metricsSubject.next(response.metrics);
      } else {
        this.metricsSubject.next(null);
      }
    } catch {
      if (this.currentTabId === tabId) this.metricsSubject.next(null);
    } finally {
      this.inFlight = false;
    }
  }
}
