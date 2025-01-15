import {AuthType} from '../Secret';

export class FTPProfile {
  public host: string = '';
  public port: number = 21;

  public initPath?: string;
  public secured: boolean = false;

  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;

}
