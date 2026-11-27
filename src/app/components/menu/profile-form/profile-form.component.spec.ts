import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService} from '@ngx-translate/core';
import {ProfileFormComponent} from './profile-form.component';
import {Profile, ProfileCategory} from '../../../domain/profile/Profile';
import {LogService} from '../../../services/log.service';
import {ProfileService} from '../../../services/profile.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {ProxyStorageService} from '../../../services/proxy-storage.service';
import {SettingService} from '../../../services/setting.service';
import {PluginRegistryService} from '../../../plugin/services/plugin-registry.service';

describe('ProfileFormComponent dynamic plugin controls', () => {
  let fixture: ComponentFixture<ProfileFormComponent>;
  let component: ProfileFormComponent;

  const metadata = new Map<string, {formControlName: string; profileField: string}>([
    ['RDP_REMOTE_DESKTOP', {formControlName: 'rdpProfileForm', profileField: 'RDP_REMOTE_DESKTOP'}],
    ['VNC_REMOTE_DESKTOP', {formControlName: 'vncProfileForm', profileField: 'VNC_REMOTE_DESKTOP'}],
  ]);

  const registry = {
    getFormMetadata: (type: string) => metadata.get(type) ?? null,
    getProfileFormComponent: () => null,
    getPluginSupportsProxy: () => false,
    getCategoryTypes: () => [],
    getExternalPluginsByCategory: () => [],
    getExternalPlugin: () => null,
    getExternalPluginFormElement: () => '',
    getExternalPluginAuthTypes: () => [],
    getExternalPluginSecretTypes: () => [],
    getExternalPluginHideLogin: () => false,
    hasExternalPlugin: () => false,
    hasExternalPluginAuth: () => false,
    getExternalPluginType: () => '',
    getProfileTypeTranslationKey: (type: string) => type,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProfileFormComponent],
      providers: [
        provideTranslateService(),
        {provide: LogService, useValue: {}},
        {provide: ProfileService, useValue: {}},
        {provide: MasterKeyService, useValue: {hasMasterKey: false}},
        {provide: SettingStorageService, useValue: {settings: {groups: [], tags: []}}},
        {provide: ProxyStorageService, useValue: {dataCopy: {proxies: []}}},
        {provide: SettingService, useValue: {}},
        {provide: PluginRegistryService, useValue: registry},
      ],
    });

    fixture = TestBed.createComponent(ProfileFormComponent);
    component = fixture.componentInstance;
    const profile = new Profile();
    profile.category = ProfileCategory.TERMINAL;
    profile.profileType = 'LOCAL_TERMINAL';
    component.profile = profile;
    fixture.detectChanges();
  });

  it('adds and removes plugin controls when the connection type changes', () => {
    component.form.get('profileType')?.setValue('RDP_REMOTE_DESKTOP');
    expect(component.form.contains('rdpProfileForm')).toBeTrue();

    component.form.get('profileType')?.setValue('VNC_REMOTE_DESKTOP');
    expect(component.form.contains('rdpProfileForm')).toBeFalse();
    expect(component.form.contains('vncProfileForm')).toBeTrue();

    component.form.get('profileType')?.setValue('LOCAL_TERMINAL');
    expect(component.form.contains('vncProfileForm')).toBeFalse();
  });

  it('patches plugin profile data into a freshly added control', () => {
    const profile = new Profile();
    profile.category = ProfileCategory.REMOTE_DESKTOP;
    profile.profileType = 'RDP_REMOTE_DESKTOP';
    profile.setProfile('RDP_REMOTE_DESKTOP', {host: 'rdp.example.com'});

    component.profile = profile;

    expect(component.form.contains('rdpProfileForm')).toBeTrue();
    expect(component.form.get('rdpProfileForm')?.value).toEqual({host: 'rdp.example.com'});
  });
});
