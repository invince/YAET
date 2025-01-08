import {AuthType} from '../Secret';

export enum ProxyType {
  HTTP = 'HTTP',
  SOCK5 = 'SOCK5',
}

export class GeneralSettings {

  autoUpdate: boolean = true;

  proxyAuthType?: AuthType;
  proxyType?: ProxyType;
  proxyUrl: string = '';
  proxyNoProxy: string = '';
  proxySecretId: string = '';
}

