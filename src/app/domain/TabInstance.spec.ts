import {TabInstance} from './TabInstance';
import {Profile, ProfileCategory, ProfileType} from './profile/Profile';
import {Session} from './session/Session';

describe('TabInstance', () => {
  it('should create with given category and session', () => {
    const profile = new Profile();
    profile.name = 'Test Profile';
    profile.profileType = ProfileType.SSH_TERMINAL;
    const session = new Session(profile, ProfileType.SSH_TERMINAL, null as any);
    const tab = new TabInstance(ProfileCategory.TERMINAL, session);

    expect(tab.id).toBe(session.id);
    expect(tab.category).toBe(ProfileCategory.TERMINAL);
    expect(tab.name).toBe('Test Profile');
    expect(tab.connected).toBeFalse();
    expect(tab.paneId).toBe(0);
  });

  it('should fallback name to profileType when profile name is empty', () => {
    const profile = new Profile();
    profile.name = '';
    profile.profileType = ProfileType.LOCAL_TERMINAL;
    const session = new Session(profile, ProfileType.LOCAL_TERMINAL, null as any);
    const tab = new TabInstance(ProfileCategory.TERMINAL, session);

    expect(tab.name).toBe('LOCAL_TERMINAL');
  });

  it('should allow setting connected and paneId', () => {
    const profile = new Profile();
    const session = new Session(profile, ProfileType.SSH_TERMINAL, null as any);
    const tab = new TabInstance(ProfileCategory.TERMINAL, session);

    tab.connected = true;
    tab.paneId = 1;

    expect(tab.connected).toBeTrue();
    expect(tab.paneId).toBe(1);
  });
});
