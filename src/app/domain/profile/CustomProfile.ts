import {AuthType} from '../Secret';

export class CustomProfile {
  public execPath!: string;

  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;

}
