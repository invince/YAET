import { Injectable } from '@angular/core';
import {Secret} from '../domain/Secret';

@Injectable({
  providedIn: 'root'
})
// to avoid circular dependency between SecretService and ElectronService
export class SecretStorageService {

  private _secrets!: Secret[];
  constructor() { }

  set secrets(value: Secret[]) {
    this._secrets = value;
  }
  get secrets(): Secret[] {
    if (!this._secrets) {
      // [TEST CODE]
      // let one = new Secret();
      // one.name = 'test';
      // one.isNew = false;
      // this._secrets = [new Secret(), one];
      this._secrets = [];
    }
    return this._secrets;
  }

  findById(id: string): Secret | undefined {
    return this._secrets.find(one => one.id == id);
  }
}
