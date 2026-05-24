import {AuthType, Secret, SecretType} from '../domain/Secret';
import {SecretStorageService} from '../services/secret-storage.service';
import {Log} from '../domain/Log';

export interface SecretFieldNames {
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

interface HasAuth {
  authType?: AuthType;
  login?: string;
  password?: string;
  secretId?: string;
}

const DEFAULT_FIELD_NAMES: SecretFieldNames = {
  username: 'username',
  password: 'password',
  privateKey: 'privateKey',
  passphrase: 'passphrase',
};

export function resolveSecretToConfig(
  config: Record<string, any>,
  profile: HasAuth,
  secretStorage: SecretStorageService,
  log: (entry: Log) => void,
  fields: SecretFieldNames = DEFAULT_FIELD_NAMES,
): boolean {
  const u = fields.username ?? 'username';
  const p = fields.password ?? 'password';

  if (profile.authType === AuthType.LOGIN) {
    config[u] = profile.login;
    config[p] = profile.password;
    return true;
  }

  if (profile.authType !== AuthType.SECRET) {
    return true;
  }

  const secret = secretStorage.findById(profile.secretId!);
  if (!secret) {
    log({level: 'error', message: 'Invalid secret ' + profile.secretId});
    return false;
  }

  applySecretToConfig(config, secret, fields);
  return true;
}

function applySecretToConfig(
  config: Record<string, any>,
  secret: Secret,
  fields: SecretFieldNames,
): void {
  const u = fields.username ?? 'username';
  const p = fields.password ?? 'password';

  switch (secret.secretType) {
    case SecretType.LOGIN_PASSWORD:
      config[u] = secret.login;
      config[p] = secret.password;
      break;

    case SecretType.SSH_KEY: {
      config[u] = secret.login;
      const pk = fields.privateKey ?? 'privateKey';
      config[pk] = secret.key.replace(/\\n/g, '\n');
      if (secret.passphrase) {
        const pp = fields.passphrase ?? 'passphrase';
        config[pp] = secret.passphrase;
      }
      break;
    }

    case SecretType.PASSWORD_ONLY:
      config[p] = secret.password;
      if (secret.login) {
        config[u] = secret.login;
      }
      break;
  }
}

export function resolveLoginPassword(
  target: Record<string, any>,
  profile: HasAuth,
  secretStorage: SecretStorageService,
  log: (entry: Log) => void,
  loginField = 'login',
  passwordField = 'password',
): boolean {
  if (profile.authType === AuthType.LOGIN) {
    target[loginField] = profile.login;
    target[passwordField] = profile.password;
    return true;
  }

  if (profile.authType !== AuthType.SECRET) {
    return true;
  }

  const secret = secretStorage.findById(profile.secretId!);
  if (!secret) {
    log({level: 'error', message: 'Invalid secret ' + profile.secretId});
    return false;
  }

  target[loginField] = secret.login;
  target[passwordField] = secret.password;
  return true;
}
