export class Proxy {
    id: string;
    name: string;
    type: 'HTTP' | 'SOCKS4' | 'SOCKS5';
    host: string;
    port: number;
    secretId?: string; // Optional secret for authentication
    isNew?: boolean;

    constructor() {
        this.id = crypto.randomUUID();
        this.name = 'New Proxy';
        this.type = 'HTTP';
        this.host = '';
        this.port = 8080;
        this.isNew = true;
    }
}

export class Proxies {
    revision: number;

    public version: string = '';
    public compatibleVersion: string = '';

    proxies: Proxy[];

    constructor() {
        this.revision = Date.now();
        this.proxies = [];
    }
}
