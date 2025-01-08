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
    return this._data;
  }

  findById(id: string): Secret | undefined {
    return this._data.secrets.find(one => one.id == id);
  }

}
