import { Injectable } from '@angular/core';
import {Secret, Secrets, SecretType} from '../domain/Secret';

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
    return this._data;
  }

  get dataCopy(): Secrets {
    let result = new Secrets(); // to avoid if this._data is deserialized we don't have fn on it
    if (this._data) {
      result.secrets = [...this._data.secrets]; // copy elements
      result.version = this._data.version;
      result.compatibleVersion = this._data.compatibleVersion;
      result.revision = this._data.revision;
    }
    return result;
  }

  findById(id: string): Secret | undefined {
    return this._data.secrets.find(one => one.id == id);
  }

  filter(predicate : (one:Secret) => boolean): Secret[] {
    return this._data.secrets?.filter(predicate);
  }

}
