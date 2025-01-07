import {AuthType} from '../Secret';

export class GeneralSettings {

  autoUpdate: boolean = true;

  proxyUrl: string = '';
  proxyAuthType?: AuthType;
  proxyLogin: string = '';
  proxyPassword: string = '';
  proxyNoProxy: string = '';
  proxySecretId: string = '';
}

