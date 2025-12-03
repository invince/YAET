import { Injectable } from '@angular/core';
import { Proxies } from '../domain/Proxy';

@Injectable({
    providedIn: 'root'
})
export class ProxyStorageService {

    data: Proxies = new Proxies();

    constructor() {
    }

    get dataCopy(): Proxies {
        return JSON.parse(JSON.stringify(this.data));
    }
}
