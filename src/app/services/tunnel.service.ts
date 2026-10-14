import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {Compatibility} from '../compatibility';
import {migrateLegacyTunnels, Tunnel, Tunnels, TunnelSnapshot} from '../domain/profile/TunnelRule';
import {ElectronService} from './electron/electron.service';
import {TUNNELS_LOADED} from './electron/ElectronConstant';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';
import {ProfileService} from './profile.service';
import {TunnelStorageService} from './tunnel-storage.service';
import {EncryptedConfigStoreService} from './config-store.service';

/**
 * Renderer facade for SSH tunnels (A1 rework: first-class tunnels).
 *
 * Two halves:
 * - Storage: decrypted tunnels.json (base class owns load/decrypt/save/reload;
 *   this class adds the one-way migration of legacy profile-embedded rules).
 * - Live: main-process TunnelService status snapshots (start/stop/statuses$).
 */
@Injectable({
  providedIn: 'root'
})
export class TunnelService extends EncryptedConfigStoreService<Tunnels> {

  static CLOUD_OPTION = 'Tunnel';

  private statusesSubject = new BehaviorSubject<TunnelSnapshot[]>([]);
  readonly statuses$ = this.statusesSubject.asObservable();

  private listening = false;
  private migrationAttempted = false;

  constructor(
    electron: ElectronService,
    log: LogService,
    private ngZone: NgZone,
    masterKeyService: MasterKeyService,
    notification: NotificationService,
    private tunnelStorage: TunnelStorageService,
    private profileService: ProfileService,
  ) {
    super(electron, log, notification, masterKeyService, {
      loadedEvent: TUNNELS_LOADED,
      storeLabel: 'tunnels',
      reload: () => electron.reloadTunnels(),
    });
    // Migration needs BOTH stores loaded; either load order is possible, so
    // retry whenever profiles land (maybeMigrate is idempotent and guarded).
    this.subscriptions.push(profileService.loaded$.subscribe(() => this.postLoad()));
  }

  // ---- EncryptedConfigStoreService contract ----

  protected override blank(): Tunnels {
    return new Tunnels();
  }

  protected override read(): Tunnels {
    return this.tunnelStorage.data;
  }

  protected override write(data: Tunnels): void {
    if (!Array.isArray(data.tunnels)) {
      data.tunnels = [];
    }
    this.tunnelStorage.data = data;
  }

  protected override readonly compatVersion = Compatibility.tunnels;
  protected override readonly incompatibleMessage =
    'Your application is not compatible with saved tunnels, please update your app. For instance, empty tunnels applied';
  protected override readonly clearedMessage = 'Tunnels cleared';

  protected override saveToMain(encrypted: string): unknown {
    return this.electron.saveTunnels(encrypted);
  }

  protected override postLoad(): void {
    this.maybeMigrate();
  }

  // ---- Storage (tunnels.json) ----

  get tunnels(): Tunnel[] {
    return this.tunnelStorage.tunnels;
  }

  getTunnel(id: string): Tunnel | undefined {
    return this.tunnelStorage.tunnels.find(t => t.id === id);
  }

  async saveAll(tunnels: Tunnels = this.tunnelStorage.data): Promise<void> {
    await this.persist(tunnels);
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

  override reload(): void {
    this.migrationAttempted = false;
    super.reload();
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
