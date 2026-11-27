import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatDialog} from '@angular/material/dialog';
import {provideTranslateService} from '@ngx-translate/core';
import {FtpProfileFormComponent} from '../../../../plugins/ftp-file-explorer/frontend/form/ftp-profile-form.component';
import {SambaFormComponent} from '../../../../plugins/samba-file-explorer/frontend/form/samba-form.component';
import {
  SerialProfileFormComponent
} from '../../../../plugins/serial-terminal/frontend/serial-profile-form.component';
import {CustomProfileFormComponent} from '../menu/profile-form/custom-profile-form/custom-profile-form.component';
import {
  RemoteTerminalProfileFormComponent
} from '../menu/profile-form/remote-terminal-profile-form/remote-terminal-profile-form.component';
import {FTPProfile} from '../../domain/profile/FTPProfile';
import {SambaProfile} from '../../domain/profile/SambaProfile';
import {CustomProfile} from '../../domain/profile/CustomProfile';
import {RemoteTerminalProfile} from '../../domain/profile/RemoteTerminalProfile';
import {AuthType} from '../../domain/Secret';
import {SecretStorageService} from '../../services/secret-storage.service';
import {SecretService} from '../../services/secret.service';
import {ProfileService} from '../../services/profile.service';

describe('Phase 3 profile forms', () => {
  let ftpFixture: ComponentFixture<FtpProfileFormComponent>;
  let sambaFixture: ComponentFixture<SambaFormComponent>;
  let customFixture: ComponentFixture<CustomProfileFormComponent>;
  let remoteFixture: ComponentFixture<RemoteTerminalProfileFormComponent>;
  let serialFixture: ComponentFixture<SerialProfileFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        FtpProfileFormComponent,
        SambaFormComponent,
        CustomProfileFormComponent,
        RemoteTerminalProfileFormComponent,
        SerialProfileFormComponent,
      ],
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
        {
          provide: ProfileService,
          useValue: {
            profilesCopy: {profiles: []},
          },
        },
      ],
    });

    ftpFixture = TestBed.createComponent(FtpProfileFormComponent);
    ftpFixture.detectChanges();
    sambaFixture = TestBed.createComponent(SambaFormComponent);
    sambaFixture.detectChanges();
    customFixture = TestBed.createComponent(CustomProfileFormComponent);
    customFixture.detectChanges();
    remoteFixture = TestBed.createComponent(RemoteTerminalProfileFormComponent);
    remoteFixture.detectChanges();
    serialFixture = TestBed.createComponent(SerialProfileFormComponent);
    serialFixture.detectChanges();
  });

  const toModel = <T>(component: unknown): T =>
    (component as {formToModel(): T}).formToModel();

  it('maps FTP fields and clears stale auth credentials', () => {
    const component = ftpFixture.componentInstance;
    const profile = new FTPProfile();
    profile.host = 'ftp.example.com';
    profile.port = 21;
    profile.initPath = '/upload';
    profile.authType = AuthType.SECRET;
    profile.login = 'old';
    profile.password = 'old';
    profile.secretId = 'secret-1';

    component.writeValue(profile);
    const result = toModel<FTPProfile>(component);

    expect(result.initPath).toBe('/upload');
    expect(result.authType).toBe(AuthType.SECRET);
    expect(result.secretId).toBe('secret-1');
    expect(result.login).toBe('');
    expect(result.password).toBeUndefined();
  });

  it('requires both login and password for FTP login auth', () => {
    const component = ftpFixture.componentInstance;
    const profile = new FTPProfile();
    profile.host = 'ftp.example.com';
    profile.authType = AuthType.LOGIN;
    profile.password = 'pass';

    component.writeValue(profile);

    expect(component.form.get('auth')?.hasError('loginRequired')).toBeTrue();
  });

  it('maps Samba share/domain fields and defaults port 445', () => {
    const component = sambaFixture.componentInstance;
    component.writeValue(null);
    const profile = new SambaProfile();
    profile.share = '\\\\host\\share';
    profile.domain = 'WORKGROUP';
    profile.authType = AuthType.LOGIN;
    profile.login = 'user';
    profile.password = 'pass';

    component.writeValue(profile);
    const result = toModel<SambaProfile>(component);

    expect(component.form.get('port')?.value).toBe(445);
    expect(result.share).toBe('\\\\host\\share');
    expect(result.domain).toBe('WORKGROUP');
    expect(result.login).toBe('user');
    expect(result.password).toBe('pass');
  });

  it('maps custom command path and secret auth', () => {
    const component = customFixture.componentInstance;
    const profile = new CustomProfile();
    profile.execPath = 'my-command --flag';
    profile.authType = AuthType.SECRET;
    profile.secretId = 'secret-2';
    profile.password = 'stale';

    component.writeValue(profile);
    const result = toModel<CustomProfile>(component);

    expect(result.execPath).toBe('my-command --flag');
    expect(result.authType).toBe(AuthType.SECRET);
    expect(result.secretId).toBe('secret-2');
    expect(result.password).toBeUndefined();
  });

  it('applies telnet defaults and hides SSH-only fields', () => {
    const component = remoteFixture.componentInstance;
    component.type = 'telnet';
    component.writeValue(null);

    expect(component.form.get('port')?.value).toBe(23);
    expect(component.isVisible('path')).toBeFalse();
    expect(component.isVisible('cmd')).toBeFalse();
    expect(component.isVisible('jumperProfileId')).toBeFalse();
    expect(component.form.get('auth')?.hasError('loginRequired')).toBeTrue();

    component.type = 'ssh';
    expect(component.isVisible('path')).toBeTrue();
    expect(component.isVisible('cmd')).toBeTrue();
    expect(component.isVisible('jumperProfileId')).toBeTrue();
  });

  it('maps remote terminal init fields from the schema', () => {
    const component = remoteFixture.componentInstance;
    component.type = 'ssh';
    const profile = new RemoteTerminalProfile(22);
    profile.host = 'ssh.example.com';
    profile.initPath = '/home/user';
    profile.initCmd = 'echo hi';
    profile.jumperProfileId = 'jump-1';
    profile.authType = AuthType.LOGIN;
    profile.login = 'user';
    profile.password = 'pass';

    component.writeValue(profile);
    const result = toModel<RemoteTerminalProfile>(component);

    expect(result.initPath).toBe('/home/user');
    expect(result.initCmd).toBe('echo hi');
    expect(result.jumperProfileId).toBe('jump-1');
    expect(result.login).toBe('user');
  });

  it('applies serial defaults and maps to a plain model', () => {
    const component = serialFixture.componentInstance;
    component.writeValue(null);

    expect(component.form.get('baudRate')?.value).toBe(9600);
    expect(component.form.get('parity')?.value).toBe('none');
    expect(toModel<Record<string, unknown>>(component)['baudRate']).toBe(9600);
  });
});
