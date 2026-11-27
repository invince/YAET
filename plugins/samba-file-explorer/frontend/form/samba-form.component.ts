import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {SambaProfile} from '../../../../src/app/domain/profile/SambaProfile';
import {ProfileFormBase, profileFormProviders} from '../../../../src/app/components/forms/profile-form.base';
import {FormModelBridge} from '../../../../src/app/utils/model-form.bridge';
import {AuthValue, mergeAuth, pickAuth} from '../../../../src/app/utils/AuthValidators';
import {AuthFormComponent} from '../../../../src/app/components/menu/profile-form/auth-form.component';

@Component({
  selector: 'app-samba-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatIconButton,
    AuthFormComponent,
  ],
  providers: profileFormProviders(() => SambaFormComponent),
  templateUrl: './samba-form.component.html',
  styleUrl: './samba-form.component.scss'
})
export class SambaFormComponent extends ProfileFormBase<SambaProfile> {

  readonly AUTH_OPTIONS: AuthType[] = [AuthType.NA, AuthType.LOGIN, AuthType.SECRET];
  readonly SECRET_TYPES: SecretType[] = [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY];

  protected override readonly bridge = new FormModelBridge<SambaProfile>([
    {form: 'share', validators: [Validators.required], defaultValue: () => ''},
    {form: 'port', validators: [Validators.required], defaultValue: () => 445},
    {form: 'domain', defaultValue: () => ''},
    {
      form: 'auth',
      fromModel: (_value, model) => pickAuth(model, AuthType.LOGIN),
      toModel: (value, model) => mergeAuth(model, value as AuthValue),
    },
  ]);

  protected override createEmptyModel(): SambaProfile {
    return new SambaProfile();
  }
}
