import { Injectable } from '@angular/core';
import { Proxies, Proxy } from '../domain/Proxy';
import { ElectronService } from './electron/electron.service';
import { ProxyStorageService } from './proxy-storage.service';

@Injectable({
    providedIn: 'root'
})
export class ProxyService {

    static CLOUD_OPTION = 'Proxy';
    private _loaded = false;

    constructor(
        private electron: ElectronService,
        private proxyStorage: ProxyStorageService
    ) { }

    get isLoaded() {
        return this._loaded;
    }

    reload() {
        this._loaded = false;
        this.electron.reloadProxies();
    }

    async saveAll(proxies: Proxies) {
        await this.electron.saveProxies(proxies);
        this.proxyStorage.data = proxies;
    }

    async deleteOne(proxy: Proxy) {
        const index = this.proxyStorage.data.proxies.findIndex(p => p.id === proxy.id);
        if (index > -1) {
            this.proxyStorage.data.proxies.splice(index, 1);
            await this.saveAll(this.proxyStorage.data);
        }
    }

    async updateOne(proxy: Proxy) {
        const index = this.proxyStorage.data.proxies.findIndex(p => p.id === proxy.id);
        if (index > -1) {
            this.proxyStorage.data.proxies[index] = proxy;
        } else {
            this.proxyStorage.data.proxies.push(proxy);
        }
        await this.saveAll(this.proxyStorage.data);
    }

    findById(id: string): Proxy | undefined {
        return this.proxyStorage.data.proxies.find(p => p.id === id);
    }
}
