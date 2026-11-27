import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {RdpProfileFormComponent} from '../../../../plugins/rdp-remote-desktop/frontend/form/rdp-profile-form.component';
import {VncProfileFormComponent} from '../../../../plugins/vnc-remote-desktop/frontend/form/vnc-profile-form.component';
import {RdpProfile} from '../../domain/profile/RdpProfile';
import {VncProfile} from '../../../../plugins/vnc-remote-desktop/frontend/domain/VncProfile';
import {AuthType} from '../../domain/Secret';
import {SecretStorageService} from '../../services/secret-storage.service';
import {SecretService} from '../../services/secret.service';

describe('RDP/VNC pilot forms', () => {
  let rdpFixture: ComponentFixture<RdpProfileFormComponent>;
  let vncFixture: ComponentFixture<VncProfileFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RdpProfileFormComponent, VncProfileFormComponent],
      providers: [
        provideTranslateService(),
        {
          provide: SecretStorageService,
          useValue: {
            dataCopy: {secrets: []},
            filter: () => [],
          },
        },
        {
          provide: SecretService,
          useValue: {
            displaySecretOptionName: (secret: { name: string }) => secret.name,
          },
        },
        {provide: MatDialog, useValue: {open: () => undefined}},
      ],
    });

    rdpFixture = TestBed.createComponent(RdpProfileFormComponent);
    rdpFixture.detectChanges();
    vncFixture = TestBed.createComponent(VncProfileFormComponent);
    vncFixture.detectChanges();
  });

  it('applies RDP defaults and requires login credentials', () => {
    const form = rdpFixture.componentInstance;
    form.writeValue(null);

    expect(form.form.get('port')?.value).toBe(3389);
    expect(form.form.get('auth')?.value).toEqual({
      authType: AuthType.LOGIN,
      login: '',
      password: '',
      secretId: '',
    });
    expect(form.form.valid).toBeFalse();
    expect(form.form.get('host')?.hasError('required')).toBeTrue();
    expect(form.form.get('auth')?.hasError('loginRequired')).toBeTrue();
  });

  it('maps RDP auth into the saved profile and clears the stale secret', () => {
    const component = rdpFixture.componentInstance;
    const profile = new RdpProfile();
    profile.host = 'rdp.example.com';
    profile.authType = AuthType.LOGIN;
    profile.login = 'user';
    profile.password = 'pass';
    profile.secretId = 'stale';

    component.writeValue(profile);
    const result = (component as unknown as {formToModel(): RdpProfile}).formToModel();

    expect(result.host).toBe('rdp.example.com');
    expect(result.login).toBe('user');
    expect(result.password).toBe('pass');
    expect(result.secretId).toBeUndefined();
  });

  it('allows RDP auth to be skipped with N/A and clears stale credentials', () => {
    const component = rdpFixture.componentInstance;
    const profile = new RdpProfile();
    profile.host = 'rdp.example.com';
    profile.authType = AuthType.NA;
    profile.login = 'stale';
    profile.password = 'stale';
    profile.secretId = 'stale';

    component.writeValue(profile);
    const result = (component as unknown as {formToModel(): RdpProfile}).formToModel();

    expect(component.form.get('auth')?.valid).toBeTrue();
    expect(result.authType).toBe(AuthType.NA);
    expect(result.login).toBe('');
    expect(result.password).toBeUndefined();
    expect(result.secretId).toBeUndefined();
  });

  it('maps VNC secret auth', () => {
    const component = vncFixture.componentInstance;
    const profile = new VncProfile();
    profile.host = 'vnc.example.com';
    profile.authType = AuthType.SECRET;
    profile.secretId = 'secret-id';

    component.writeValue(profile);
    const result = (component as unknown as {formToModel(): VncProfile}).formToModel();

    expect(result.host).toBe('vnc.example.com');
    expect(result.authType).toBe(AuthType.SECRET);
    expect(result.secretId).toBe('secret-id');
    expect(result.password).toBeUndefined();
  });

  it('defaults VNC to login and requires a password', () => {
    const component = vncFixture.componentInstance;

    component.writeValue(null);

    expect(component.form.get('auth')?.value).toEqual({
      authType: AuthType.LOGIN,
      login: '',
      password: '',
      secretId: '',
    });
    expect(component.form.get('auth')?.hasError('passwordRequired')).toBeTrue();
    expect(component.form.valid).toBeFalse();
  });

  it('requires a VNC login password', () => {
    const component = vncFixture.componentInstance;
    const profile = new VncProfile();
    profile.host = 'vnc.example.com';
    profile.authType = AuthType.LOGIN;
    profile.password = '';

    component.writeValue(profile);

    expect(component.form.get('auth')?.hasError('passwordRequired')).toBeTrue();
    expect(component.form.valid).toBeFalse();
  });
});
