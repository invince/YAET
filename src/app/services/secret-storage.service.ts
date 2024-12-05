import { Injectable } from '@angular/core';
import {Secret, Secrets} from '../domain/Secret';

@Injectable({
  providedIn: 'root'
})
// to avoid circular dependency between SecretService and ElectronService
export class SecretStorageService {

  private _data!: Secrets;
  constructor() { }

  set data(data: Secrets) {
    this._data = data;
  }

  get data(): Secrets {
    if (!this._data) {
      this._data = new Secrets();
    }
    if (!this._data.secrets) {
      this._data.secrets = [];
    }
    return this._data;
  }

  findById(id: string): Secret | undefined {
    return this._data.secrets.find(one => one.id == id);
  }

  updateSecret($event: Secret) {
    if ($event) {
      let index = this._data.secrets.findIndex(one => one.id == $event.id);
      if (index >= 0) {
        this._data.secrets[index] = $event;
      } else {
        console.warn("Secret not found, we'll add new secret");
        this._data.secrets.push($event);
      }
    }
  }
}
