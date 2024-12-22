import {v4 as uuidv4} from 'uuid';
import {Profile} from './profile/Profile';


export enum SecretType {
  PASSWORD_ONLY = 'PASSWORD_ONLY',
  LOGIN_PASSWORD = 'LOGIN_PASSWORD',
  SSH_KEY = 'SSH_KEY',
}


export enum AuthType {

  NA = 'N/A',
  LOGIN = 'login',
  SECRET = 'secret',
}

export class Secrets {

  revision: number;

  secrets: Secret[];

  constructor() {
    this.revision = Date.now();
    this.secrets = [];
  }

  update($event: Secret) {
    if ($event) {
      let index = this.secrets.findIndex(one => one.id == $event.id);
      if (index >= 0) {
        this.secrets[index] = $event;
      } else {
        console.warn("Secret not found, we'll add new secret");
        this.secrets.push($event);
      }
    }
  }
  delete(secret: Secret) {
    if (!secret) {
      return;
    }
    if (!this.secrets) {
      this.secrets= [];
    }
    this.secrets = this.secrets.filter(one => one.id != secret.id);
  }

}

export class Secret {

  id: string = uuidv4();

  secretType: SecretType = SecretType.LOGIN_PASSWORD;
  name!: string;
  login!: string;
  password!: string;

  key!: string;

  passphrase!: string;

  isNew: boolean = true;
}
