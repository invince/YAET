import {AuthType} from '../Secret';

export class VncProfile {
  public host: string = '';
  public port: number = 5900;

  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;

}
