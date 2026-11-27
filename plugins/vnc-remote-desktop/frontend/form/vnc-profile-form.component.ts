import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {VncProfile} from '../domain/VncProfile';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {ProfileFormBase, profileFormProviders} from '../../../../src/app/components/forms/profile-form.base';
import {FormModelBridge} from '../../../../src/app/utils/model-form.bridge';
import {AuthValue, mergeAuth, pickAuth} from '../../../../src/app/utils/AuthValidators';
import {AuthFormComponent} from '../../../../src/app/components/menu/profile-form/auth-form.component';

@Component({
  selector: 'app-vnc-profile-form',
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
  providers: profileFormProviders(() => VncProfileFormComponent),
  templateUrl: './vnc-profile-form.component.html',
  styleUrl: './vnc-profile-form.component.scss'
})
export class VncProfileFormComponent extends ProfileFormBase<VncProfile> {

  readonly AUTH_OPTIONS: AuthType[] = [AuthType.NA, AuthType.LOGIN, AuthType.SECRET];
  readonly SECRET_TYPES: SecretType[] = [SecretType.PASSWORD_ONLY];

  protected override readonly bridge = new FormModelBridge<VncProfile>([
    {form: 'host', validators: [Validators.required], defaultValue: () => ''},
    {form: 'port', validators: [Validators.required], defaultValue: () => 5900},
    {
      form: 'auth',
      fromModel: (_value, model) => pickAuth(model, AuthType.LOGIN),
      toModel: (value, model) => mergeAuth(model, value as AuthValue),
    },
  ]);

  protected override createEmptyModel(): VncProfile {
    return new VncProfile();
  }
}
