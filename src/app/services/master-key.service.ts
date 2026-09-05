import {Injectable, OnDestroy} from '@angular/core';
import {Subject, Subscription} from 'rxjs';
import {ElectronService} from './electron/electron.service';
import {LogService} from './log.service';

@Injectable({
  providedIn: 'root'
})
export class MasterKeyService implements OnDestroy {

  private _masterKeyLoaded: boolean = false;

  private _hasMasterKey?: boolean;

  private subscriptions: Subscription[] = [];

  private cleanupFns: (() => void)[] = [];

  // NOTE: 'invalid' is emitted when the user force-continues with a wrong/absent
  // old password (they accept losing the old data). Every data service that
  // subscribes clears its in-memory store and re-saves an empty blob under the
  // current key. There is no longer a 'reencrypt' event: re-encryption now
  // happens atomically in the main process inside masterkey.change.
  private updateEventSubject = new Subject<string>();
  updateEvent$ = this.updateEventSubject.asObservable();

  constructor(
    private log: LogService,
    private electron: ElectronService,
  ) {
    this.refreshHasMasterKey();
    this.listenForMasterKeyChanges();
  }


  ngOnDestroy(): void {
    this.subscriptions.forEach(one => one.unsubscribe());
    this.cleanupFns.forEach(fn => fn());
  }

  private listenForMasterKeyChanges() {
    const unsubscribe = this.electron.onMasterKeyChanged(() => {
      this.refreshHasMasterKey();
    });
    if (unsubscribe) {
      this.cleanupFns.push(unsubscribe);
    }
  }

  private refreshHasMasterKey() {
    this.electron.masterKeyExists().then(exists => {
      this._hasMasterKey = exists;
      this._masterKeyLoaded = true;
    });
  }

  deleteMasterKey() {
    this.electron.deletePassword().then(r => {
      this.refreshHasMasterKey();
    });
  }

  get hasMasterKey() {
    return this._hasMasterKey;
  }

  get isMasterKeyLoaded() {
    return this._masterKeyLoaded;
  }


  async matchMasterKey(masterKey: string): Promise<boolean> {
    return await this.electron.matchMasterKey(masterKey);
  }

  /**
   * Set the master key the very first time (no existing key, nothing to migrate).
   */
  saveMasterKey(masterKey: string) {
    this.electron.setPassword(masterKey).then(r => {
      this.refreshHasMasterKey();
    });
  }

  /**
   * Change an existing master key. The old password is validated and every
   * encrypted config (profiles/secrets/proxies/cloud) is atomically migrated in
   * the MAIN process (read with old key -> switch keyring -> write with new key).
   * Never run re-encryption in the renderer from in-memory copies — that was the
   * source of data loss (stale/empty in-memory data could be written back).
   */
  async changeMasterKey(oldMasterKey: string, newMasterKey: string): Promise<{ok: boolean; reason?: string}> {
    const result = await this.electron.changeMasterKey(oldMasterKey, newMasterKey);
    this.refreshHasMasterKey();
    return result;
  }

  async encrypt(obj: any) {
    try {
      return await this.electron.encrypt(obj);
    } catch {
      this.log.info("Unable to load master key");
      return null;
    }
  }

  async decrypt2String(encrypted: string) {
    try {
      return await this.electron.decrypt(encrypted);
    } catch {
      this.log.info("No master key defined");
      return null;
    }
  }

  invalidSettings() {
    this.updateEventSubject.next('invalid');
  }
}
