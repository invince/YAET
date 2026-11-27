import {FormControl} from '@angular/forms';
import {AuthType} from '../domain/Secret';
import {authRequiredValidator, mergeAuth, pickAuth} from './AuthValidators';

describe('AuthValidators', () => {
  it('picks auth fields and defaults a missing auth type to N/A', () => {
    expect(pickAuth(null)).toBeNull();
    expect(pickAuth({login: 'user'})).toEqual({
      authType: AuthType.NA,
      login: 'user',
      password: '',
      secretId: '',
    });
  });

  it('uses a caller-provided fallback auth type', () => {
    expect(pickAuth({}, AuthType.LOGIN)?.authType).toBe(AuthType.LOGIN);
  });

  it('merges login auth and clears the stale secret', () => {
    const target = {
      authType: AuthType.SECRET,
      login: 'old',
      password: 'old',
      secretId: 'old-secret',
    };

    mergeAuth(target, {authType: AuthType.LOGIN, login: 'user', password: 'pass'});

    expect(target.authType).toBe(AuthType.LOGIN);
    expect(target.login).toBe('user');
    expect(target.password).toBe('pass');
    expect(target.secretId).toBeUndefined();
  });

  it('merges secret auth and clears the stale password', () => {
    const target = {
      authType: AuthType.LOGIN,
      login: 'user',
      password: 'pass',
      secretId: 'secret',
    };

    mergeAuth(target, {authType: AuthType.SECRET, secretId: 'new-secret'});

    expect(target.authType).toBe(AuthType.SECRET);
    expect(target.login).toBe('');
    expect(target.password).toBeUndefined();
    expect(target.secretId).toBe('new-secret');
  });

  it('clears all auth fields for N/A', () => {
    const target = {
      authType: AuthType.LOGIN,
      login: 'user',
      password: 'pass',
      secretId: 'secret',
    };

    mergeAuth(target, {authType: AuthType.NA});

    expect(target.authType).toBe(AuthType.NA);
    expect(target.login).toBe('');
    expect(target.password).toBeUndefined();
    expect(target.secretId).toBeUndefined();
  });

  it('requires a password for login and a secret for secret auth', () => {
    expect(authRequiredValidator(new FormControl({authType: AuthType.LOGIN}))).toEqual({passwordRequired: true});
    expect(authRequiredValidator(new FormControl({authType: AuthType.LOGIN, password: 'pass'}))).toBeNull();
    expect(authRequiredValidator(new FormControl({authType: AuthType.SECRET}))).toEqual({secretRequired: true});
    expect(authRequiredValidator(new FormControl({authType: AuthType.SECRET, secretId: 'secret'}))).toBeNull();
    expect(authRequiredValidator(new FormControl({authType: AuthType.NA}))).toBeNull();
  });

  it('optionally requires a login name', () => {
    const control = new FormControl({authType: AuthType.LOGIN, login: '', password: 'pass'});

    expect(authRequiredValidator(control, true)).toEqual({loginRequired: true});
    control.setValue({authType: AuthType.LOGIN, login: 'user', password: 'pass'});
    expect(authRequiredValidator(control, true)).toBeNull();
  });
});
