import {AuthType} from '../Secret';

export class SSHProfile {
  public host: string = '';
  public port: number = 22;

  public initPath?: string;

  public initCmd?: string;
  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;

}
