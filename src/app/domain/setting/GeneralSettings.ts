import {AuthType} from '../Secret';

export class GeneralSettings {

  autoUpdate: boolean = true;

  proxyAuthType?: AuthType;
  proxyUrl: string = '';
  proxyNoProxy: string = '';
  proxySecretId: string = '';
}

