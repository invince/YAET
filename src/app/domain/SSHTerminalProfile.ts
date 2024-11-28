import {AuthType} from './Secret';

export class SSHTerminalProfile {
  public host: string = '';
  public port: number = 22;

  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;
}
