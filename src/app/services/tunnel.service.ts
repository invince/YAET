import {Injectable, NgZone, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subscription} from 'rxjs';
import packageJson from '../../../package.json';
import {Compatibility} from '../compatibility';
import {migrateLegacyTunnels, Tunnel, Tunnels, TunnelSnapshot} from '../domain/profile/TunnelRule';
import {compareVersions} from '../utils/VersionUtils';
import {ElectronService} from './electron/electron.service';
import {TUNNELS_LOADED} from './electron/ElectronConstant';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';
import {ProfileService} from './profile.service';
import {TunnelStorageService} from './tunnel-storage.service';

/**
 * Renderer facade for SSH tunnels (A1 rework: first-class tunnels).
 *
 * Two halves, mirroring ProxyService + live status:
 * - Storage: decrypted tunnels.json (load/decrypt/save/reload + one-way
 *   migration of legacy profile-embedded rules).
 * - Live: main-process TunnelService status snapshots (start/stop/statuses$).
 */
@Injectable({
  providedIn: 'root'
})
export class TunnelService implements OnDestroy {

  static CLOUD_OPTION = 'Tunnel';

  private statusesSubject = new BehaviorSubject<TunnelSnapshot[]>([]);
  readonly statuses$ = this.statusesSubject.asObservable();

  private subscriptions: Subscription[] = [];
  private listening = false;
  private _loaded = false;
  private migrationAttempted = false;

  constructor(
    private electron: ElectronService,
    private log: LogService,
    private ngZone: NgZone,
    private masterKeyService: MasterKeyService,
    private notification: NotificationService,
    private tunnelStorage: TunnelStorageService,
    private profileService: ProfileService,
  ) {
    electron.onLoadedEvent(TUNNELS_LOADED, data => this.apply(data));
    this.subscriptions.push(masterKeyService.updateEvent$.subscribe({
      next: event => {
        // 'invalid' fires only on force-continue (user accepted losing old data).
        if (event === 'invalid') {
          this.tunnelStorage.data = new Tunnels();
          this.saveAll();
          this.notification.info('Tunnels cleared');
        }
      },
      error: err => this.log.error('Tunnel service update event error: ' + err)
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  // ---- Storage (tunnels.json) ----

  get isLoaded(): boolean {
    return this._loaded;
  }

  get tunnels(): Tunnel[] {
    return this.tunnelStorage.tunnels;
  }

  getTunnel(id: string): Tunnel | undefined {
    return this.tunnelStorage.tunnels.find(t => t.id === id);
  }

  private apply(data: unknown): void {
    if (!data) {
      this._loaded = true;
      this.maybeMigrate();
      return;
    }
    this.masterKeyService.decrypt2String(data as string).then(
      decrypted => {
        if (decrypted) {
          try {
            const dataObj = JSON.parse(decrypted);
            if (dataObj?.compatibleVersion) {
              if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
                const msg = 'Your application is not compatible with saved tunnels, please update your app. For instance, empty tunnels applied';
                this.log.warn(msg);
                this.notification.info(msg);
                this.tunnelStorage.data = new Tunnels();
              } else {
                this.tunnelStorage.data = dataObj;
              }
            } else {
              this.tunnelStorage.data = dataObj;
            }
            if (!Array.isArray(this.tunnelStorage.data.tunnels)) {
              this.tunnelStorage.data.tunnels = [];
            }
          } catch (e) {
            this.log.error('Failed to parse tunnels data: ' + e);
            this.notification.error('Failed to load tunnels: corrupted data');
            this.tunnelStorage.data = new Tunnels();
          }
          this._loaded = true;
          this.maybeMigrate();
        }
      }
    );
  }

  async saveAll(tunnels: Tunnels = this.tunnelStorage.data): Promise<void> {
    if (!tunnels) {
      tunnels = new Tunnels();
    }
    tunnels.version = packageJson.version;
    tunnels.compatibleVersion = Compatibility.tunnels;
    tunnels.revision = Date.now();
    this.tunnelStorage.data = tunnels;
    const encrypted = await this.masterKeyService.encrypt(tunnels);
    if (encrypted) {
      await this.electron.saveTunnels(encrypted);
    }
  }

  async saveOne(tunnel: Tunnel): Promise<void> {
    const copy = this.tunnelStorage.dataCopy;
    if (!Array.isArray(copy.tunnels)) copy.tunnels = [];
    const index = copy.tunnels.findIndex(t => t.id === tunnel.id);
    if (index >= 0) {
      copy.tunnels[index] = JSON.parse(JSON.stringify(tunnel));
    } else {
      copy.tunnels.push(JSON.parse(JSON.stringify(tunnel)));
    }
    await this.saveAll(copy);
  }

  async deleteOne(id: string): Promise<void> {
    const copy = this.tunnelStorage.dataCopy;
    copy.tunnels = (copy.tunnels || []).filter(t => t.id !== id);
    await this.saveAll(copy);
    // Stopping a deleted tunnel is best-effort — the entry may not exist.
    try {
      await this.stop(id);
    } catch (_) { /* already stopped or never started */ }
  }

  reload(): void {
    this._loaded = false;
    this.migrationAttempted = false;
    this.electron.reloadTunnels();
  }

  /**
   * One-way migration of legacy profile-embedded rules into tunnels.json.
   * Idempotent: only rule ids unknown to the store are moved; source profiles
   * are cleared and re-saved when anything moved.
   */
  private maybeMigrate(): void {
    if (this.migrationAttempted || !this._loaded || !this.profileService.isLoaded) return;
    this.migrationAttempted = true;

    const profiles = this.profileService.profilesCopy.profiles;
    const takenIds = new Set(this.tunnelStorage.tunnels.map(t => t.id));
    const moved = migrateLegacyTunnels(profiles, takenIds);
    if (moved.length === 0) return;

    const copy = this.tunnelStorage.dataCopy;
    if (!Array.isArray(copy.tunnels)) copy.tunnels = [];
    copy.tunnels.push(...moved);
    void this.saveAll(copy).then(() => {
      // Clear the embedded copies so rules don't live in two places.
      let cleared = false;
      for (const profile of this.profileService.profilesCopy.profiles) {
        const conn = profile.getProfile('SSH_TERMINAL') as { tunnels?: unknown[] } | undefined;
        if (conn && Array.isArray(conn.tunnels) && conn.tunnels.length > 0) {
          conn.tunnels = [];
          cleared = true;
        }
      }
      if (cleared) {
        void this.profileService.save().then(() => {
          this.notification.info(`Migrated ${moved.length} tunnel rule(s) to the tunnel manager`);
        });
      } else {
        this.notification.info(`Migrated ${moved.length} tunnel rule(s) to the tunnel manager`);
      }
    });
  }

  // ---- Live status (main-process TunnelService) ----

  /** Start listening for main-process status pushes (call once, e.g. from the manager). */
  ensureListening(): void {
    if (this.listening) return;
    this.listening = true;
    this.electron.onTunnelStatusChanged((list: TunnelSnapshot[]) => {
      this.ngZone.run(() => this.statusesSubject.next(Array.isArray(list) ? list : []));
    });
    this.refresh().catch(err => this.log.warn('tunnel status refresh failed: ' + err));
  }

  get statuses(): TunnelSnapshot[] {
    return this.statusesSubject.value;
  }

  statusOf(tunnelId: string): TunnelSnapshot | undefined {
    return this.statusesSubject.value.find(s => s.tunnelId === tunnelId);
  }

  async refresh(): Promise<TunnelSnapshot[]> {
    const snapshots = await this.electron.listTunnels();
    this.statusesSubject.next(snapshots);
    return snapshots;
  }

  async start(tunnelId: string): Promise<TunnelSnapshot> {
    const snapshot = await this.electron.startTunnel(tunnelId);
    await this.refresh().catch(() => { /* status push will cover it */ });
    return snapshot;
  }

  async stop(tunnelId: string): Promise<boolean> {
    const result = await this.electron.stopTunnel(tunnelId);
    await this.refresh().catch(() => { /* status push will cover it */ });
    return !!result;
  }

  async stopAll(): Promise<void> {
    await this.electron.stopAllTunnels();
    await this.refresh().catch(() => { /* status push will cover it */ });
  }
}
