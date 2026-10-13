import {ProfileCategory} from '../../domain/profile/Profile';
import {PluginFrontend} from '../plugin-manifest';
import {PluginRegistryService} from './plugin-registry.service';

function makePlugin(id: string, profileType: string, enabled = true): PluginFrontend {
  return {
    manifest: {
      id, name: id, category: ProfileCategory.TERMINAL,
      profileType, enabled,
    },
    profileFormComponent: null,
    sessionComponent: null,
  } as unknown as PluginFrontend;
}

describe('PluginRegistryService', () => {
  let registry: PluginRegistryService;

  beforeEach(() => {
    registry = new PluginRegistryService();
  });

  it('ships core category types', () => {
    const terminal = registry.getCategoryTypes(ProfileCategory.TERMINAL);
    expect(terminal.map(t => t.profileType)).toContain('LOCAL_TERMINAL');
    expect(registry.getProfileIcon('LOCAL_TERMINAL')).toBe('terminal');
    expect(registry.getProfileTypeTranslationKey('LOCAL_TERMINAL')).toBe('PROFILES.LOCAL_TERMINAL');
  });

  it('registerCategoryType dedups and resolves icons/keys', () => {
    registry.registerCategoryType(ProfileCategory.TERMINAL, 'SSH_TERMINAL', 'PROFILES.SSH', 'ssh-icon');
    registry.registerCategoryType(ProfileCategory.TERMINAL, 'SSH_TERMINAL', 'PROFILES.SSH', 'ssh-icon');
    expect(registry.getCategoryTypes(ProfileCategory.TERMINAL).filter(t => t.profileType === 'SSH_TERMINAL').length).toBe(1);
    expect(registry.getProfileIcon('SSH_TERMINAL')).toBe('ssh-icon');
    expect(registry.getProfileTypeTranslationKey('SSH_TERMINAL')).toBe('PROFILES.SSH');
    expect(registry.getProfileIcon('UNKNOWN_X')).toBe('terminal');
    expect(registry.getProfileTypeTranslationKey('UNKNOWN_X')).toBe('UNKNOWN_X');
    expect(registry.getAllCategoryTypes().has(ProfileCategory.TERMINAL)).toBeTrue();
  });

  it('register/getPluginById/unregister round-trip', () => {
    registry.register(makePlugin('ssh', 'SSH_TERMINAL'));
    expect(registry.getPluginById('ssh')?.manifest.profileType).toBe('SSH_TERMINAL');
    expect(registry.getPlugin('SSH_TERMINAL')?.manifest.id).toBe('ssh');
    expect(registry.hasPlugin('SSH_TERMINAL')).toBeTrue();
    expect(registry.hasPlugin('NOPE')).toBeFalse();
    expect(registry.getAllPlugins().length).toBe(1);
    registry.unregister('ssh');
    expect(registry.getPluginById('ssh')).toBeUndefined();
  });

  it('filters by category and enabled flag', () => {
    registry.register(makePlugin('a', 'A_T', true));
    registry.register(makePlugin('b', 'B_T', false));
    expect(registry.getPluginsByCategory(ProfileCategory.TERMINAL).map(p => p.manifest.id)).toEqual(['a']);
    expect(registry.getEnabledPlugins().map(p => p.manifest.id)).toEqual(['a']);
    expect(registry.getSessionComponent('A_T')).toBeNull();
    expect(registry.getProfileFormComponent('A_T')).toBeNull();
  });

  it('tracks external plugins separately', () => {
    expect(registry.hasExternalPlugin('EXT_T')).toBeFalse();
    registry.registerExternalPlugin({
      id: 'ext', name: 'ext', category: ProfileCategory.TERMINAL,
      profileType: 'EXT_T', profileFormElement: 'x-form',
    });
    expect(registry.hasExternalPlugin('EXT_T')).toBeTrue();
    expect(registry.getExternalPlugin('EXT_T')?.id).toBe('ext');
    expect(registry.getExternalPluginsByCategory(ProfileCategory.TERMINAL).length).toBe(1);
    expect(registry.getExternalPluginsByCategory(ProfileCategory.REMOTE_DESKTOP).length).toBe(0);
    registry.unregister('ext');
    expect(registry.hasExternalPlugin('EXT_T')).toBeFalse();
  });

  it('resolves form metadata from map first, bundled fallback second', () => {
    expect(registry.getFormMetadata('SSH_TERMINAL')).toBeNull();
    registry.registerFormMetadata('SSH_TERMINAL', 'remoteTerminalProfileForm', 'SSH_TERMINAL');
    expect(registry.getFormMetadata('SSH_TERMINAL')).toEqual({
      formControlName: 'remoteTerminalProfileForm', profileField: 'SSH_TERMINAL',
    });
    registry.registerBundledPlugin({
      id: 'scp', name: 'scp', category: ProfileCategory.FILE_EXPLORER,
      profileType: 'SCP_FILE_EXPLORER', profileFormElement: '',
      formControlName: 'remoteTerminalProfileForm', profileField: 'SSH_TERMINAL',
      frontendEntry: './scp.plugin',
    });
    expect(registry.getBundledPlugin('SCP_FILE_EXPLORER')?.id).toBe('scp');
    expect(registry.getBundledPluginsWithEntries().map(p => p.id)).toEqual(['scp']);
    expect(registry.getFormMetadata('SCP_FILE_EXPLORER')).toEqual({
      formControlName: 'remoteTerminalProfileForm', profileField: 'SSH_TERMINAL',
    });
  });

  it('getPluginSupportsProxy excludes local/custom only', () => {
    expect(registry.getPluginSupportsProxy('')).toBeFalse();
    expect(registry.getPluginSupportsProxy('LOCAL_TERMINAL')).toBeFalse();
    expect(registry.getPluginSupportsProxy('CUSTOM')).toBeFalse();
    expect(registry.getPluginSupportsProxy('SSH_TERMINAL')).toBeTrue();
  });

  it('getProfileOpenNewTab defaults true, honors opt-outs', () => {
    expect(registry.getProfileOpenNewTab('CUSTOM')).toBeFalse();
    expect(registry.getProfileOpenNewTab('UNKNOWN_T')).toBeTrue();
    registry.registerBundledPlugin({
      id: 'x', name: 'x', category: ProfileCategory.TERMINAL,
      profileType: 'X_T', profileFormElement: '', openNewTab: false,
    });
    expect(registry.getProfileOpenNewTab('X_T')).toBeFalse();
  });
});
