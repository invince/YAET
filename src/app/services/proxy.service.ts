import {Injectable} from '@angular/core';
import {Compatibility} from '../compatibility';
import {Proxies, Proxy} from '../domain/Proxy';
import {ElectronService} from './electron/electron.service';
import {PROXIES_LOADED} from './electron/ElectronConstant';
import {LogService} from './log.service';
import {MasterKeyService} from './master-key.service';
import {NotificationService} from './notification.service';
import {ProxyStorageService} from './proxy-storage.service';
import {EncryptedConfigStoreService} from './config-store.service';

@Injectable({
    providedIn: 'root'
})
export class ProxyService extends EncryptedConfigStoreService<Proxies> {

    static CLOUD_OPTION = 'Proxy';

    constructor(
        log: LogService,
        electron: ElectronService,
        private proxyStorage: ProxyStorageService,
        masterKeyService: MasterKeyService,
        notification: NotificationService,
    ) {
        super(electron, log, notification, masterKeyService, {
            loadedEvent: PROXIES_LOADED,
            storeLabel: 'proxies',
            reload: () => electron.reloadProxies(),
        });
    }

    // ---- EncryptedConfigStoreService contract ----

    protected override blank(): Proxies {
        return new Proxies();
    }

    protected override read(): Proxies {
        return this.proxyStorage.data;
    }

    protected override write(data: Proxies): void {
        this.proxyStorage.data = data;
    }

    protected override readonly compatVersion = Compatibility.proxies;
    protected override readonly incompatibleMessage =
        "Your application is not compatible with saved settings, please update your app. For instance, empty proxies applied";
    protected override readonly clearedMessage = 'Proxies cleared';

    protected override saveToMain(encrypted: string): unknown {
        return this.electron.saveProxies(encrypted);
    }

    protected override preSave(proxies: Proxies): void {
        for (const one of proxies.proxies) {
            one.isNew = false;
        }
    }

    // ---- Domain API (unchanged) ----

    get proxies() {
        return this.proxyStorage.data?.proxies || [];
    }

    async saveAll(proxies: Proxies = this.proxyStorage.data) {
        await this.persist(proxies);
    }

    deleteOne(proxy: Proxy) {
        if (!proxy) {
            return;
        }
        if (!this.proxyStorage.data) {
            this.proxyStorage.data = new Proxies();
        }
        if (!this.proxyStorage.data.proxies) {
            this.proxyStorage.data.proxies = [];
        }
        this.proxyStorage.data.proxies = this.proxyStorage.data.proxies.filter(one => one.id != proxy.id);
    }

    updateOne(proxy: Proxy) {
        if (proxy) {
            if (!this.proxyStorage.data) {
                this.proxyStorage.data = new Proxies();
            }
            if (!this.proxyStorage.data.proxies) {
                this.proxyStorage.data.proxies = [];
            }
            const index = this.proxyStorage.data.proxies.findIndex(p => p.id === proxy.id);
            if (index > -1) {
                this.proxyStorage.data.proxies[index] = proxy;
            } else {
                console.warn("Proxy not found, we'll add new proxy");
                this.proxyStorage.data.proxies.push(proxy);
            }
        }
    }

    findById(id: string): Proxy | undefined {
        return this.proxyStorage.data.proxies.find(p => p.id === id);
    }
}
