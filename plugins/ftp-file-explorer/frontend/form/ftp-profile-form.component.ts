import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {FTPProfile} from '../../../../src/app/domain/profile/FTPProfile';
import {ProfileFormBase, profileFormProviders} from '../../../../src/app/components/forms/profile-form.base';
import {FormModelBridge} from '../../../../src/app/utils/model-form.bridge';
import {AuthValue, mergeAuth, pickAuth} from '../../../../src/app/utils/AuthValidators';
import {AuthFormComponent} from '../../../../src/app/components/menu/profile-form/auth-form.component';

@Component({
  selector: 'app-ftp-profile-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatIconButton,
    MatSlideToggle,
    AuthFormComponent,
  ],
  providers: profileFormProviders(() => FtpProfileFormComponent),
  templateUrl: './ftp-profile-form.component.html',
  styleUrl: './ftp-profile-form.component.scss'
})
export class FtpProfileFormComponent extends ProfileFormBase<FTPProfile> {

  readonly AUTH_OPTIONS: AuthType[] = [AuthType.NA, AuthType.LOGIN, AuthType.SECRET];
  readonly SECRET_TYPES: SecretType[] = [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY, SecretType.SSH_KEY];

  protected override readonly bridge = new FormModelBridge<FTPProfile>([
    {form: 'host', validators: [Validators.required], defaultValue: () => ''},
    {form: 'port', validators: [Validators.required], defaultValue: () => 21},
    {form: 'secured', defaultValue: () => false},
    {form: 'path', model: 'initPath', defaultValue: () => ''},
    {
      form: 'auth',
      fromModel: (_value, model) => pickAuth(model, AuthType.LOGIN),
      toModel: (value, model) => mergeAuth(model, value as AuthValue),
    },
  ]);

  protected override createEmptyModel(): FTPProfile {
    return new FTPProfile();
  }
}
