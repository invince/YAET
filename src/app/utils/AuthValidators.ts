import {AbstractControl, ValidationErrors} from '@angular/forms';
import {AuthType} from '../domain/Secret';

export interface AuthValue {
  authType?: AuthType | string;
  login?: string;
  password?: string;
  secretId?: string;
}

export function pickAuth(model: AuthValue | null | undefined, fallback: AuthType = AuthType.NA): AuthValue | null {
  if (!model) {
    return null;
  }
  return {
    authType: model.authType || fallback,
    login: model.login || '',
    password: model.password || '',
    secretId: model.secretId || '',
  };
}

export function mergeAuth(target: AuthValue, value: AuthValue | null | undefined): void {
  const authType = value?.authType || AuthType.NA;
  target.authType = authType;

  if (authType === AuthType.LOGIN) {
    target.login = value?.login || '';
    target.password = value?.password || '';
    delete target.secretId;
  } else if (authType === AuthType.SECRET) {
    target.login = '';
    delete target.password;
    target.secretId = value?.secretId || '';
  } else {
    target.login = '';
    delete target.password;
    delete target.secretId;
  }
}

export function authRequiredValidator(control: AbstractControl, requireLogin = false): ValidationErrors | null {
  const value = control.value as AuthValue | null;
  if (!value) {
    return null;
  }

  const authType = value.authType || AuthType.NA;
  if (authType === AuthType.LOGIN) {
    if (requireLogin && !value.login) {
      return {loginRequired: true};
    }
    if (!value.password) {
      return {passwordRequired: true};
    }
  }
  if (authType === AuthType.SECRET && !value.secretId) {
    return {secretRequired: true};
  }
  return null;
}
