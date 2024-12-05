import {AuthType} from './Secret';

export class CloudSettings {
  public url!: string;
  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;
}

