import {CUSTOM_PROFILE, LOCAL_TERMINAL, Profile, ProfileCategory, Profiles} from './Profile';
import {Secret} from '../Secret';

describe('Profile', () => {
  it('should create with default values', () => {
    const p = new Profile();
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('');
    expect(p.category).toBe(ProfileCategory.TERMINAL);
    expect(p.profileType).toBe(LOCAL_TERMINAL);
    expect(p.isNew).toBeTrue();
  });

  it('should clone a profile with "Clone" suffix', () => {
    const original = new Profile();
    original.name = 'Production Server';
    original.comment = 'Important server';
    original.category = ProfileCategory.TERMINAL;
    original.profileType = 'SSH_TERMINAL';
    original.group = 'group-1';
    original.proxyId = 'proxy-1';

    const cloned = Profile.clone(original);
    expect(cloned.name).toBe('Production Server Clone');
    expect(cloned.comment).toBe('Important server');
    expect(cloned.category).toBe(ProfileCategory.TERMINAL);
    expect(cloned.profileType).toBe('SSH_TERMINAL');
    expect(cloned.group).toBe('group-1');
    expect(cloned.proxyId).toBe('proxy-1');
    expect(cloned.id).not.toBe(original.id);
  });

  it('should clone and copy profile data', () => {
    const original = new Profile();
    original.setProfile('SSH_TERMINAL', {host: '10.0.0.1', port: 22});

    const cloned = Profile.clone(original);
    expect(cloned.getProfile('SSH_TERMINAL').host).toBe('10.0.0.1');
    expect(cloned.getProfile('SSH_TERMINAL').port).toBe(22);
    cloned.getProfile('SSH_TERMINAL').host = '10.0.0.2';
    expect(original.getProfile('SSH_TERMINAL').host).toBe('10.0.0.1');
  });

  it('should detect if profile uses a secret', () => {
    const secret = new Secret();
    secret.id = 'secret-1';

    const p = new Profile();
    expect(Profile.useSecret(p, secret)).toBeFalse();

    p.setProfile('SSH_TERMINAL', {secretId: 'secret-1'});
    expect(Profile.useSecret(p, secret)).toBeTrue();
  });

  it('should check all sub-profile types for secret usage', () => {
    const secret = new Secret();
    secret.id = 'secret-1';
    const p = new Profile();

    p.setProfile('TELNET_TERMINAL', {secretId: 'secret-1'});
    expect(Profile.useSecret(p, secret)).toBeTrue();

    p.setProfile('WIN_RM_TERMINAL', {secretId: 'secret-1'});
    expect(Profile.useSecret(p, secret)).toBeTrue();

    p.setProfile('FTP_FILE_EXPLORER', {secretId: 'secret-1'});
    expect(Profile.useSecret(p, secret)).toBeTrue();
  });

  it('should clear secret from all sub-profiles', () => {
    const secret = new Secret();
    secret.id = 'secret-1';

    const p = new Profile();
    p.setProfile('SSH_TERMINAL', {secretId: 'secret-1'});
    p.setProfile('TELNET_TERMINAL', {secretId: 'secret-1'});
    p.setProfile('WIN_RM_TERMINAL', {secretId: 'secret-1'});

    Profile.clearSecret(p, secret);
    expect(p.getProfile('SSH_TERMINAL').secretId).toBe('');
    expect(p.getProfile('TELNET_TERMINAL').secretId).toBe('');
    expect(p.getProfile('WIN_RM_TERMINAL').secretId).toBe('');
  });

  it('requireOpenNewTab should return true for SSH', () => {
    const p = new Profile();
    p.profileType = 'SSH_TERMINAL';
    expect(Profile.requireOpenNewTab(p)).toBeTrue();
  });

  it('requireOpenNewTab should return false for RDP with map', () => {
    const p = new Profile();
    p.profileType = 'RDP_REMOTE_DESKTOP';
    expect(Profile.requireOpenNewTab(p, { 'RDP_REMOTE_DESKTOP': false })).toBeFalse();
  });

  it('requireOpenNewTab should return false for CUSTOM', () => {
    const p = new Profile();
    p.profileType = CUSTOM_PROFILE;
    expect(Profile.requireOpenNewTab(p)).toBeFalse();
  });
});

describe('Profiles', () => {
  let profiles: Profiles;

  beforeEach(() => {
    profiles = new Profiles();
  });

  it('should start empty', () => {
    expect(profiles.profiles.length).toBe(0);
  });

  it('should add a new profile', () => {
    const p = new Profile();
    p.id = 'test-1';
    profiles.update(p);
    expect(profiles.profiles.length).toBe(1);
    expect(profiles.profiles[0].id).toBe('test-1');
  });

  it('should update an existing profile', () => {
    const p = new Profile();
    p.id = 'test-1';
    p.name = 'Original';
    profiles.update(p);

    p.name = 'Updated';
    profiles.update(p);
    expect(profiles.profiles.length).toBe(1);
    expect(profiles.profiles[0].name).toBe('Updated');
  });

  it('should delete a profile by id', () => {
    const p1 = new Profile();
    p1.id = 'test-1';
    const p2 = new Profile();
    p2.id = 'test-2';

    profiles.update(p1);
    profiles.update(p2);
    expect(profiles.profiles.length).toBe(2);

    profiles.delete(p1);
    expect(profiles.profiles.length).toBe(1);
    expect(profiles.profiles[0].id).toBe('test-2');
  });

  it('should handle deleting non-existent profile gracefully', () => {
    const p = new Profile();
    p.id = 'non-existent';
    expect(() => profiles.delete(p)).not.toThrow();
  });
});
