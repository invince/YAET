import {TabInstance} from './TabInstance';
import {LOCAL_TERMINAL, Profile, ProfileCategory} from './profile/Profile';
import {Session} from './session/Session';

describe('TabInstance', () => {
  it('should create with given category and session', () => {
    const profile = new Profile();
    profile.name = 'Test Profile';
    profile.profileType = 'SSH_TERMINAL';
    const session = new Session(profile, 'SSH_TERMINAL', null as any);
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
    profile.profileType = LOCAL_TERMINAL;
    const session = new Session(profile, LOCAL_TERMINAL, null as any);
    const tab = new TabInstance(ProfileCategory.TERMINAL, session);

    expect(tab.name).toBe('LOCAL_TERMINAL');
  });

  it('should allow setting connected and paneId', () => {
    const profile = new Profile();
    const session = new Session(profile, 'SSH_TERMINAL', null as any);
    const tab = new TabInstance(ProfileCategory.TERMINAL, session);

    tab.connected = true;
    tab.paneId = 1;

    expect(tab.connected).toBeTrue();
    expect(tab.paneId).toBe(1);
  });
});
