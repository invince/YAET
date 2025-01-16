import {Injectable, OnDestroy} from '@angular/core';
import {ElectronService} from './electron/electron.service';
import CryptoJS from 'crypto-js';
import {Subject, Subscription} from 'rxjs';
import {Profile} from '../domain/profile/Profile';
import {LogService} from './log.service';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationComponent} from '../components/confirmation/confirmation.component';

@Injectable({
  providedIn: 'root'
})
export class MasterKeyService implements OnDestroy{

  private static readonly service:string = 'io.github.invince.YAET';
  private static readonly account:string = 'ac13ba1ac2f841d19a9f73bd8c335086';
  private _masterKeyLoaded: boolean = false;

  private _hasMasterKey?: boolean;
  private readonly intervalId: NodeJS.Timeout;

  private subscriptions: Subscription[] = [];

  private updateEventSubject = new Subject<string>();
  updateEvent$ = this.updateEventSubject.asObservable();

  constructor(
    private log: LogService,
    private electron: ElectronService,
    private dialog: MatDialog,
  ) {

    this.refreshHasMasterKey();
    this.intervalId = setInterval(()=> this.refreshHasMasterKey(), 30 * 1000)
  }


  // This will be called when the service is destroyed
  ngOnDestroy(): void {
    clearInterval(this.intervalId); // Clean up resources
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  private refreshHasMasterKey() {
    this.electron.getPassword(MasterKeyService.service, MasterKeyService.account).then(key => {
      if (key && key.length > 0) {
        this._hasMasterKey = true;
      } else {
        this._hasMasterKey = false;
      }
      this._masterKeyLoaded = true;
    });
  }

  deleteMasterKey() {
    this.electron.deletePassword(MasterKeyService.service, MasterKeyService.account).then(r => {
      this.refreshHasMasterKey();
    });
  }

  get hasMasterKey() {
    return this._hasMasterKey;
  }

  get isMasterKeyLoaded() {
    return this._masterKeyLoaded;
  }


  private async getMasterKey() : Promise<string|undefined> {
    return await this.electron.getPassword(MasterKeyService.service, MasterKeyService.account);
  }

  async matchMasterKey(masterKey: string) : Promise<boolean> {
    const key = await this.electron.getPassword(MasterKeyService.service, MasterKeyService.account);
    return masterKey === key;
  }

  saveMasterKey(masterKey: string, suggestReencrypt: boolean = false) {
    this.electron.setPassword(MasterKeyService.service, MasterKeyService.account, masterKey).then(r => {
      this.refreshHasMasterKey();
      if (suggestReencrypt) {
        const dialogRef = this.dialog.open(ConfirmationComponent, {
          width: '300px',
          data: { message: 'Master Key changed, do you want re-encrypt settings?' },
        });
        this.subscriptions.push(dialogRef.afterClosed().subscribe(result => {
          if (result) {
            this.log.debug('Start re-encrypt');
            this.updateEventSubject.next('reencrypt');
          }
        }));
      }
    });
  }


  async encrypt(obj: any) {
    const masterKey = await this.getMasterKey();
    if (masterKey) {
      const json = JSON.stringify(obj, null, 2);
      return CryptoJS.AES.encrypt(json, masterKey).toString();
    } else {
      this.log.info("Unable to load master key");
      return null;
    }
  }

  async decrypt2String(encrypted: string) {
    const masterKey = await this.getMasterKey();
    if (masterKey) {
      const bytes = CryptoJS.AES.decrypt(encrypted, masterKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } else {
      this.log.info("No master key defined");
      return null;
    }
  }

  invalidSettings() {
    this.updateEventSubject.next('invalid');
  }
}
