import { Injectable } from '@angular/core';
import { Proxies } from '../domain/Proxy';
import { ElectronService } from './electron/electron.service';
import { PROXIES_LOADED } from './electron/ElectronConstant';

@Injectable({
    providedIn: 'root'
})
export class ProxyStorageService {

    data: Proxies = new Proxies();

    constructor(private electron: ElectronService) {
        electron.onLoadedEvent(PROXIES_LOADED, data => this.apply(data));
    }

    private apply(data: any) {
        if (data) {
            this.data = data;
        } else {
            this.data = new Proxies();
        }
    }

    get dataCopy(): Proxies {
        return JSON.parse(JSON.stringify(this.data));
    }
}
