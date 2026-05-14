import {Profile, ProfileCategory, ProfileCategoryTypeMap, Profiles, ProfileType} from './Profile';
import {Secret} from '../Secret';

describe('ProfileCategoryTypeMap', () => {
  it('should map TERMINAL to terminal types', () => {
    const types = ProfileCategoryTypeMap.get(ProfileCategory.TERMINAL);
    expect(types).toContain(ProfileType.LOCAL_TERMINAL);
    expect(types).toContain(ProfileType.SSH_TERMINAL);
    expect(types).toContain(ProfileType.TELNET_TERMINAL);
    expect(types).toContain(ProfileType.WIN_RM_TERMINAL);
  });

  it('should map REMOTE_DESKTOP to remote desktop types', () => {
    const types = ProfileCategoryTypeMap.get(ProfileCategory.REMOTE_DESKTOP);
    expect(types).toContain(ProfileType.VNC_REMOTE_DESKTOP);
    expect(types).toContain(ProfileType.RDP_REMOTE_DESKTOP);
  });

  it('should map FILE_EXPLORER to file explorer types', () => {
    const types = ProfileCategoryTypeMap.get(ProfileCategory.FILE_EXPLORER);
    expect(types).toContain(ProfileType.SCP_FILE_EXPLORER);
    expect(types).toContain(ProfileType.FTP_FILE_EXPLORER);
    expect(types).toContain(ProfileType.SAMBA_FILE_EXPLORER);
  });

  it('should map CUSTOM to custom type', () => {
    const types = ProfileCategoryTypeMap.get(ProfileCategory.CUSTOM);
    expect(types).toContain(ProfileType.CUSTOM);
  });
});

describe('Profile', () => {
  it('should create with default values', () => {
    const p = new Profile();
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('');
    expect(p.category).toBe(ProfileCategory.TERMINAL);
    expect(p.profileType).toBe(ProfileType.LOCAL_TERMINAL);
    expect(p.isNew).toBeTrue();
    expect(p.localTerminal).toBeTruthy();
    expect(p.sshProfile).toBeTruthy();
    expect(p.rdpProfile).toBeTruthy();
  });

  it('should clone a profile with "Clone" suffix', () => {
    const original = new Profile();
    original.name = 'Production Server';
    original.comment = 'Important server';
    original.category = ProfileCategory.TERMINAL;
    original.profileType = ProfileType.SSH_TERMINAL;
    original.group = 'group-1';
    original.proxyId = 'proxy-1';

    const cloned = Profile.clone(original);
    expect(cloned.name).toBe('Production Server Clone');
    expect(cloned.comment).toBe('Important server');
    expect(cloned.category).toBe(ProfileCategory.TERMINAL);
    expect(cloned.profileType).toBe(ProfileType.SSH_TERMINAL);
    expect(cloned.group).toBe('group-1');
    expect(cloned.proxyId).toBe('proxy-1');
    expect(cloned.id).not.toBe(original.id);
  });

  it('should clone and copy sub-profiles', () => {
    const original = new Profile();
    original.sshProfile.host = '10.0.0.1';
    original.sshProfile.port = 22;

    const cloned = Profile.clone(original);
    expect(cloned.sshProfile.host).toBe('10.0.0.1');
    expect(cloned.sshProfile.port).toBe(22);
    cloned.sshProfile.host = '10.0.0.2';
    // Original should be unaffected
    expect(original.sshProfile.host).toBe('10.0.0.1');
  });

  it('should detect if profile uses a secret', () => {
    const secret = new Secret();
    secret.id = 'secret-1';

    const p = new Profile();
    expect(Profile.useSecret(p, secret)).toBeFalse();

    p.sshProfile.secretId = 'secret-1';
    expect(Profile.useSecret(p, secret)).toBeTrue();
  });

  it('should check all sub-profile types for secret usage', () => {
    const secret = new Secret();
    secret.id = 'secret-1';
    const p = new Profile();

    p.telnetProfile.secretId = 'secret-1';
    expect(Profile.useSecret(p, secret)).toBeTrue();

    p.winRmProfile.secretId = 'secret-1';
    expect(Profile.useSecret(p, secret)).toBeTrue();

    p.ftpProfile.secretId = 'secret-1';
    expect(Profile.useSecret(p, secret)).toBeTrue();
  });

  it('should clear secret from all sub-profiles', () => {
    const secret = new Secret();
    secret.id = 'secret-1';

    const p = new Profile();
    p.sshProfile.secretId = 'secret-1';
    p.telnetProfile.secretId = 'secret-1';
    p.winRmProfile.secretId = 'secret-1';

    Profile.clearSecret(p, secret);
    expect(p.sshProfile.secretId).toBe('');
    expect(p.telnetProfile.secretId).toBe('');
    expect(p.winRmProfile.secretId).toBe('');
  });

  it('requireOpenNewTab should return true for SSH', () => {
    const p = new Profile();
    p.profileType = ProfileType.SSH_TERMINAL;
    expect(Profile.requireOpenNewTab(p)).toBeTrue();
  });

  it('requireOpenNewTab should return false for RDP', () => {
    const p = new Profile();
    p.profileType = ProfileType.RDP_REMOTE_DESKTOP;
    expect(Profile.requireOpenNewTab(p)).toBeFalse();
  });

  it('requireOpenNewTab should return false for CUSTOM', () => {
    const p = new Profile();
    p.profileType = ProfileType.CUSTOM;
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
