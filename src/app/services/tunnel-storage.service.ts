import { Injectable } from '@angular/core';
import { Tunnel, Tunnels } from '../domain/profile/TunnelRule';

@Injectable({
    providedIn: 'root'
})
export class TunnelStorageService {

    data: Tunnels = new Tunnels();

    constructor() {
    }

    get dataCopy(): Tunnels {
        return JSON.parse(JSON.stringify(this.data));
    }

    get tunnels(): Tunnel[] {
        return this.data?.tunnels || [];
    }
}
