import {Injectable} from '@angular/core';

/**
 * Holds the runtime Express backend port and bearer token,
 * received from the Electron main process via IPC on app startup.
 * Both values are ephemeral and change every time the app is launched.
 */
@Injectable({
  providedIn: 'root'
})
export class BackendConfigService {
  private _port: number = 13012; // safe fallback
  private _token: string = '';

  get apiRoot(): string {
    return `http://localhost:${this._port}/api`;
  }

  get authorizationHeader(): string {
    return `Bearer ${this._token}`;
  }

  get isReady(): boolean {
    return !!this._token;
  }

  setConfig(port: number, token: string) {
    this._port = port;
    this._token = token;
  }
}
