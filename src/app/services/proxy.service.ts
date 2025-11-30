import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import packageJson from '../../../package.json';
import { Compatibility } from '../../main';
import { Proxies, Proxy } from '../domain/Proxy';
import { compareVersions } from '../utils/VersionUtils';
import { ElectronService } from './electron/electron.service';
import { PROXIES_LOADED } from './electron/ElectronConstant';
import { LogService } from './log.service';
import { MasterKeyService } from './master-key.service';
import { NotificationService } from './notification.service';
import { ProxyStorageService } from './proxy-storage.service';
@Injectable({
    providedIn: 'root'
})
export class ProxyService implements OnDestroy {

    static CLOUD_OPTION = 'Proxy';
    private _loaded = false;
    private subscriptions: Subscription[] = [];

    constructor(
        private log: LogService,
        private electron: ElectronService,
        private proxyStorage: ProxyStorageService,
        private masterKeyService: MasterKeyService,
        private notification: NotificationService,
    ) {
        console.log('ProxyService initialized, subscribing to', PROXIES_LOADED);
        electron.onLoadedEvent(PROXIES_LOADED, data => {
            this.apply(data);
        });

        this.subscriptions.push(masterKeyService.updateEvent$.subscribe(event => {
            if (event === 'invalid') {
                this.proxyStorage.data = new Proxies();
                this.saveAll();
                this.notification.info('Proxies cleared');
            } else {
                this.saveAll();
                this.notification.info('Proxies re-encrypted');
            }

        }));
    }

    ngOnDestroy(): void {
        if (this.subscriptions) {
            this.subscriptions.forEach(one => one.unsubscribe());
        }
    }

    private apply(data: any) {
        if (!data) {
            this._loaded = true; // this means you don't have profile yet
            return;
        }
        this.masterKeyService.decrypt2String(data).then(
            decrypted => {
                if (decrypted) {
                    let dataObj = JSON.parse(decrypted);
                    if (dataObj) {
                        if (dataObj.compatibleVersion) {
                            if (compareVersions(dataObj.compatibleVersion, packageJson.version) > 0) {
                                let msg = "Your application is not compatible with saved settings, please update your app. For instance, empty proxies applied";
                                this.log.warn(msg);
                                this.notification.info(msg);
                                dataObj = new Proxies();
                            }
                        }
                    }
                    this.proxyStorage.data = dataObj;
                    this._loaded = true;
                }
            }
        )
    }

    get isLoaded() {
        return this._loaded;
    }

    reload() {
        console.log('ProxyService reloading...');
        this._loaded = false;
        this.electron.reloadProxies();
    }

    async saveAll(proxies: Proxies = this.proxyStorage.data) {
        if (!proxies) {
            proxies = new Proxies();
        }
        proxies.version = packageJson.version;
        proxies.compatibleVersion = Compatibility.proxies;
        proxies.revision = Date.now();
        for (let one of proxies.proxies) {
            one.isNew = false;
        }
        this.proxyStorage.data = proxies;
        this.masterKeyService.encrypt(this.proxyStorage.data).then(
            encrypted => {
                if (encrypted) {
                    this.electron.saveProxies(encrypted);
                }
            }
        )
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
