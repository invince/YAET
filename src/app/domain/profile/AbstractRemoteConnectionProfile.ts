import {AuthType} from '../Secret';

export class AbstractRemoteConnectionProfile {
  public host: string = '';
  public port: number = 0;



  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;

}
