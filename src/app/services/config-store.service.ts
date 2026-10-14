import {Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Subscription} from 'rxjs';
import packageJson from '../../../package.json';
import {compareVersions} from '../utils/VersionUtils';
import {ElectronService} from './electron/electron.service';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';

/**
 * Minimum shape for version-stamped config payloads. `revision` is optional —
 * not every store tracks it (e.g. cloud settings don't).
 */
export interface StampedData {
  version: string;
  compatibleVersion: string;
  revision?: number;
}

/**
 * Per-store wiring. Passed as a plain object to `super()` because subclass
 * field initializers (and `this`) don't exist yet when the base constructor
 * runs — only constructor parameters and imports may be captured here.
 */
export interface StoreConfig {
  /** One-shot `*.loaded` push event sent on `did-finish-load` (and `*.reload`). */
  loadedEvent: string;
  /** Domain label used in log/notification messages, e.g. 'tunnels'. */
  storeLabel: string;
  /** Re-request the payload from main, e.g. `() => electron.reloadTunnels()`. */
  reload: () => void;
  /**
   * Fallback snapshot for when the one-shot push was missed (root services
   * are lazy — anything instantiated after `did-finish-load` never sees it).
   * Settings already survives this way via `settings.get`.
   */
  snapshotProvider?: () => Promise<unknown>;
}

/**
 * Shared skeleton for the `*.loaded → apply → save → *.reload` config stores
 * (profiles, secrets, proxies, tunnels, cloud, settings).
 *
 * Template-method pattern: the base owns the load flag, the `loaded$`
 * notification, the reload poke and the version-compatibility check;
 * subclasses only provide state access plus small hooks. See
 * `EncryptedConfigStoreService` for the master-key-encrypted stores.
 */
@Injectable()
export abstract class ConfigStoreService<TData> implements OnDestroy {

  protected _loaded = false;
  private loadedSubject = new BehaviorSubject<boolean>(false);
  /** Emits whenever the store finishes (re)loading — UI rebuilds on this. */
  readonly loaded$ = this.loadedSubject.asObservable();
  protected subscriptions: Subscription[] = [];
  protected readonly storeConfig: StoreConfig;

  constructor(
    protected electron: ElectronService,
    protected log: LogService,
    protected notification: NotificationService,
    config: StoreConfig,
  ) {
    this.storeConfig = config;
    electron.onLoadedEvent(config.loadedEvent, data => this.apply(data));
    // The one-shot push may already be gone (lazy instantiation) — pull once.
    config.snapshotProvider?.().then(data => {
      if (data) this.apply(data);
    }).catch(err => {
      const msg = `Failed to load ${config.storeLabel} during startup fallback: ` + (err?.message || err);
      this.log.warn(msg);
      this.notification.error(msg);
      if (!this._loaded) {
        this.apply(null);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  get isLoaded(): boolean {
    return this._loaded;
  }

  /** Re-request the payload from main; `apply` + `loaded$` follow on arrival. */
  reload(): void {
    this._loaded = false;
    this.loadedSubject.next(false);
    this.storeConfig.reload();
  }

  /** Store finished loading — flip the flag and notify the UI. */
  protected markLoaded(): void {
    this._loaded = true;
    this.loadedSubject.next(true);
  }

  /**
   * Shared `compatibleVersion` gate. Returns the parsed object, or the blank
   * replacement (with a user-facing warning) when the saved data is newer
   * than this app. The message is caller-supplied so existing wording stays
   * byte-identical per store.
   */
  protected ensureCompatible(dataObj: TData, blank: TData, message: string): TData {
    const savedVersion = (dataObj as unknown as { compatibleVersion?: string })?.compatibleVersion;
    if (dataObj && savedVersion) {
      if (compareVersions(savedVersion, packageJson.version) > 0) {
        this.log.warn(message);
        this.notification.info(message);
        return blank;
      }
    }
    return dataObj;
  }

  protected abstract apply(data: unknown): void;
}

/**
 * Base for the master-key-encrypted stores (profiles, secrets, proxies,
 * tunnels, cloud). Owns decrypt → parse → compat-check → assign, the
 * master-key-'invalid' reset, and the stamp → encrypt → send save path.
 *
 * Subclass contract (all used post-construction, so plain fields are fine):
 * - `blank()` / `read()` / `write()` — state access
 * - `compatVersion`, `incompatibleMessage`, `clearedMessage` — literals
 * - `saveToMain(encrypted)` — the `*.save` send
 * - optional `postLoad()` (deserialize / migrate / validate follow-ups)
 * - optional `preSave(data)` (per-item fixups like icons / isNew flags)
 * - optional `stampRevision = false` (cloud has no revision field)
 * - optional `createBlankOnSave = false` (cloud skips empty saves)
 */
@Injectable()
export abstract class EncryptedConfigStoreService<TData extends StampedData> extends ConfigStoreService<TData> {

  protected stampRevision = true;
  protected createBlankOnSave = true;

  protected abstract blank(): TData;
  protected abstract read(): TData;
  protected abstract write(data: TData): void;
  protected abstract readonly compatVersion: string;
  protected abstract readonly incompatibleMessage: string;
  protected abstract readonly clearedMessage: string;
  protected abstract saveToMain(encrypted: string): unknown;

  constructor(
    electron: ElectronService,
    log: LogService,
    notification: NotificationService,
    protected masterKeyService: MasterKeyService,
    config: StoreConfig,
  ) {
    super(electron, log, notification, config);
    this.subscriptions.push(masterKeyService.updateEvent$.subscribe({
      next: event => {
        // 'invalid' fires only on force-continue (user accepted losing old data).
        // Master-key re-encryption happens atomically in the main process,
        // so there is no per-service re-encrypt to run here.
        if (event === 'invalid') {
          this.write(this.blank());
          void this.persist();
          this.notification.info(this.clearedMessage);
        }
      },
      error: err => this.log.error(`${config.storeLabel} service update event error: ` + err)
    }));
  }

  protected apply(data: unknown): void {
    if (!data) {
      // No saved payload yet — loaded, but stay on current (blank) state.
      this.markLoaded();
      this.postLoad();
      return;
    }
    this.masterKeyService.decrypt2String(data as string).then(
      decrypted => {
        if (!decrypted) {
          // Master key unavailable — stay not-loaded so a later reload()
          // retries instead of showing a permanently empty list.
          this.log.warn(`${this.storeConfig.storeLabel} load skipped: decrypted payload is empty`);
          return;
        }
        try {
          const parsed = this.ensureCompatible(JSON.parse(decrypted) as TData, this.blank(), this.incompatibleMessage);
          this.write(parsed);
        } catch (e) {
          this.log.error(`Failed to parse ${this.storeConfig.storeLabel} data: ` + e);
          this.notification.error(`Failed to load ${this.storeConfig.storeLabel}: corrupted data`);
          this.write(this.blank());
        }
        this.markLoaded();
        this.postLoad();
      },
      err => this.log.error(`Failed to decrypt ${this.storeConfig.storeLabel} data: ` + err)
    );
  }

  /** Follow-up work after the store lands (deserialization, migration...). */
  protected postLoad(): void { /* default: nothing */ }

  /**
   * Stamp → fix up → store → encrypt → send. Subclasses keep their existing
   * public save names (`save` / `saveAll`) as thin delegates so callers
   * don't change.
   */
  protected async persist(data?: TData): Promise<void> {
    let current = data ?? this.read();
    if (!current) {
      if (!this.createBlankOnSave) return;
      current = this.blank();
    }
    current.version = packageJson.version;
    current.compatibleVersion = this.compatVersion;
    if (this.stampRevision) {
      current.revision = Date.now();
    }
    this.preSave(current);
    this.write(current);
    const encrypted = await this.masterKeyService.encrypt(current);
    if (encrypted) {
      await this.saveToMain(encrypted);
    }
  }

  /** Per-item fixups before encrypt (icons, isNew flags...). */
  protected preSave(_data: TData): void { /* default: nothing */ }
}
