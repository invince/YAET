import { Injectable } from '@angular/core';
import {Secret} from '../domain/Secret';
import {ElectronService} from './electron.service';
import {PROFILES_LOADED, SECRETS_LOADED} from './electronConstant';
import {Profile} from '../domain/Profile';

@Injectable({
  providedIn: 'root'
})
export class SecretsService {

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
    return this._secrets;
  }
}
