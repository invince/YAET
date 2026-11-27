import {Component, Input, SimpleChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatSelectModule} from '@angular/material/select';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {AuthType, SecretType} from '../../../../domain/Secret';
import {RemoteTerminalProfile} from '../../../../domain/profile/RemoteTerminalProfile';
import {Profile} from '../../../../domain/profile/Profile';
import {ProfileService} from '../../../../services/profile.service';
import {ProfileFormBase, profileFormProviders} from '../../../forms/profile-form.base';
import {FormModelBridge} from '../../../../utils/model-form.bridge';
import {AuthValue, mergeAuth, pickAuth} from '../../../../utils/AuthValidators';
import {AuthFormComponent} from '../auth-form.component';

@Component({
  selector: 'app-remote-terminal-profile-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatIconButton,
    MatSelectModule,
    CdkTextareaAutosize,
    AuthFormComponent,
  ],
  providers: profileFormProviders(() => RemoteTerminalProfileFormComponent),
  templateUrl: './remote-terminal-profile-form.component.html',
  styleUrl: './remote-terminal-profile-form.component.scss'
})
export class RemoteTerminalProfileFormComponent extends ProfileFormBase<RemoteTerminalProfile> {

  @Input() type!: string;
  @Input() supportedSecretType: SecretType[] = [SecretType.LOGIN_PASSWORD, SecretType.SSH_KEY];

  readonly AUTH_OPTIONS: AuthType[] = [AuthType.NA, AuthType.LOGIN, AuthType.SECRET];

  protected override readonly bridge = new FormModelBridge<RemoteTerminalProfile>([
    {form: 'host', validators: [Validators.required], defaultValue: () => ''},
    {form: 'port', validators: [Validators.required], defaultValue: () => this.defaultPort()},
    {
      form: 'path',
      model: 'initPath',
      defaultValue: () => '',
      visibleWhen: () => this.type !== 'telnet',
    },
    {
      form: 'cmd',
      model: 'initCmd',
      defaultValue: () => '',
      visibleWhen: () => this.type !== 'scp' && this.type !== 'telnet',
    },
    {
      form: 'jumperProfileId',
      defaultValue: () => '',
      visibleWhen: () => this.type !== 'telnet' && this.type !== 'scp' && this.type !== 'winrm',
    },
    {
      form: 'auth',
      fromModel: (_value, model) => pickAuth(model, AuthType.LOGIN),
      toModel: (value, model) => mergeAuth(model, value as AuthValue),
    },
  ]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['type'] && this.form) {
      this.form.updateValueAndValidity();
    }
  }

  protected override createEmptyModel(): RemoteTerminalProfile {
    return new RemoteTerminalProfile(this.defaultPort());
  }

  filterJumperProfiles(): Profile[] {
    const all = this.profileService?.profilesCopy?.profiles || [];
    return all.filter(one => one.profileType === 'SSH_TERMINAL');
  }

  private defaultPort(): number {
    if (this.type === 'telnet') return 23;
    if (this.type === 'winrm') return 5985;
    return 22;
  }

  constructor(public profileService: ProfileService) {
    super();
  }
}
