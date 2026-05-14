import {AuthType, Secret, Secrets, SecretType} from './Secret';

describe('Secret', () => {
  it('should create with default values', () => {
    const secret = new Secret();
    expect(secret.id).toBeTruthy();
    expect(secret.secretType).toBe(SecretType.LOGIN_PASSWORD);
    expect(secret.isNew).toBeTrue();
    expect(secret.icon).toBe('');
  });

  it('should allow setting properties', () => {
    const secret = new Secret();
    secret.name = 'My Secret';
    secret.login = 'admin';
    secret.password = 'pass123';
    secret.secretType = SecretType.PASSWORD_ONLY;
    expect(secret.name).toBe('My Secret');
    expect(secret.login).toBe('admin');
    expect(secret.password).toBe('pass123');
    expect(secret.secretType).toBe(SecretType.PASSWORD_ONLY);
  });
});

describe('Secrets', () => {
  it('should create with empty secrets array', () => {
    const list = new Secrets();
    expect(list.secrets).toEqual([]);
    expect(list.revision).toBeTruthy();
    expect(list.version).toBe('');
  });

  it('should allow adding secrets', () => {
    const list = new Secrets();
    const secret = new Secret();
    list.secrets.push(secret);
    expect(list.secrets.length).toBe(1);
  });
});

describe('Enums', () => {
  it('SecretType should have expected values', () => {
    expect(SecretType.PASSWORD_ONLY).toBe('PASSWORD_ONLY');
    expect(SecretType.LOGIN_PASSWORD).toBe('LOGIN_PASSWORD');
    expect(SecretType.SSH_KEY).toBe('SSH_KEY');
  });

  it('AuthType should have expected values', () => {
    expect(AuthType.NA).toBe('N/A');
    expect(AuthType.LOGIN).toBe('login');
    expect(AuthType.SECRET).toBe('secret');
  });
});
