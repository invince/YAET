import {v4 as uuidv4} from 'uuid';


export enum SecretType {
  PASSWORD_ONLY = 'PASSWORD_ONLY',
  LOGIN_PASSWORD = 'LOGIN_PASSWORD',
  SSH_KEY = 'SSH_KEY',
}

export class Secret {

  id: string = uuidv4();

  secretType: SecretType = SecretType.LOGIN_PASSWORD;
  name!: string;
  login!: string;
  password!: string;

  key!: string;

  keyphrase!: string;

  isNew: boolean = true;
}
