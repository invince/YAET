import {Injectable, OnDestroy} from '@angular/core';
import {ElectronService} from './electron.service';
import CryptoJS from 'crypto-js';
import {Subject} from 'rxjs';
import {Profile} from '../domain/profile/Profile';

@Injectable({
  providedIn: 'root'
})
export class MasterKeyService implements OnDestroy{

  private static readonly service:string = 'io.github.invince.YAET';
  private static readonly account:string = 'ac13ba1ac2f841d19a9f73bd8c335086';
  private _masterKeyLoaded: boolean = false;

  private _hasMasterKey?: boolean;
  private readonly intervalId: NodeJS.Timeout;

  private masterkeyUpdateEventSubject = new Subject<string>();
  masterkeyUpdateEvent$ = this.masterkeyUpdateEventSubject.asObservable();

  constructor(private electron: ElectronService) {

    this.refreshHasMasterKey();
    this.intervalId = setInterval(()=> this.refreshHasMasterKey(), 30 * 1000)
  }


  // This will be called when the service is destroyed
  ngOnDestroy(): void {
    clearInterval(this.intervalId); // Clean up resources
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

  saveMasterKey(masterKey: string) {
    this.electron.setPassword(MasterKeyService.service, MasterKeyService.account, masterKey).then(r => {
      this.refreshHasMasterKey();
      this.masterkeyUpdateEventSubject.next('update');
    });
  }


  encrypt(obj: any) {
    return this.getMasterKey().then(
      masterKey => {
        if (masterKey) {
          const json = JSON.stringify(obj, null, 2);
          return CryptoJS.AES.encrypt(json, masterKey).toString();
        } else {
          console.log("Unable to load master key")
          return null;
        }
      }
    )
  }

  decrypt2String(encrypted: string) {
    return this.getMasterKey().then(
      masterKey => {
        if (masterKey) {
          const bytes = CryptoJS.AES.decrypt(encrypted, masterKey);
          return bytes.toString(CryptoJS.enc.Utf8);
        } else {
          console.error("No master key defined");
          return null;
        }
      }
    )
  }
}
