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
    let result = new Secrets(); // to avoid if this._profiles is deserialized we don't have fn on it
    if (this._data) {
      result.secrets = [...this._data.secrets]; // copy elements
    }
    return result;
  }

  findById(id: string): Secret | undefined {
    return this._data.secrets.find(one => one.id == id);
  }

}
