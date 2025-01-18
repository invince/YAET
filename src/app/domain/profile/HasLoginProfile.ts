import {AuthType} from '../Secret';

export class HasLoginProfile {
  public authType?: AuthType;
  public login: string = '';
  public password: string = '';
  public secretId!: string;
}
