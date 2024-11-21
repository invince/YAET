import { Injectable } from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {SECRETS_LOADED} from './electronConstant';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SecretsService {

  private secretsLoadedSubject = new Subject<any>();
  secretsLoadedEvent = this.secretsLoadedSubject.asObservable(); // Expose as Observable
  private _secrets!: Secret[];

  private _loaded: boolean = false;

  constructor(private electron: ElectronService) {
    electron.onLoadedEvent(SECRETS_LOADED, data => this.apply(data))
  }

  private apply(data: any) {
    if (typeof data === "string") {
      this._secrets = JSON.parse(data);
    } else {
      this._secrets = data;
    }
    this._loaded = true;
  }
  get isLoaded() {
    return this._loaded;
  }

  set secrets(value: Secret[]) {
    this._secrets = value;
  }
  get secrets(): Secret[] {
    if (!this._secrets) {
      this._secrets = [new Secret()];
    }
    if (this._secrets.length == 0) {
      this._secrets.push(new Secret());
    }
    return this._secrets;
  }

  reload() {
    this._loaded = false;
    this.electron.reloadSettings();
  }

  async hasMasterKey(): Promise<boolean> {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    const key = await this.electron.getPassword(service, account);
    return key !== null;
  }

  async matchMasterKey(masterKey: string) : Promise<boolean> {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    const key = await this.electron.getPassword(service, account);
    return masterKey === key;
  }

  async saveMasterKey(masterKey: string) {
    const service = 'io.github.invince.YAET';
    const account = 'ac13ba1ac2f841d19a9f73bd8c335086';
    await this.electron.setPassword(service, account, masterKey);
  }
}
