import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {AuthType, SecretType} from '../../../../domain/Secret';
import {CustomProfile} from '../../../../domain/profile/CustomProfile';
import {ProfileFormBase, profileFormProviders} from '../../../forms/profile-form.base';
import {FormModelBridge} from '../../../../utils/model-form.bridge';
import {AuthValue, mergeAuth, pickAuth} from '../../../../utils/AuthValidators';
import {AuthFormComponent} from '../auth-form.component';

@Component({
  selector: 'app-custom-profile-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatIconButton,
    CdkTextareaAutosize,
    AuthFormComponent,
  ],
  templateUrl: './custom-profile-form.component.html',
  styleUrl: './custom-profile-form.component.scss',
  providers: profileFormProviders(() => CustomProfileFormComponent),
})
export class CustomProfileFormComponent extends ProfileFormBase<CustomProfile> {

  readonly AUTH_OPTIONS: AuthType[] = [AuthType.NA, AuthType.LOGIN, AuthType.SECRET];
  readonly SECRET_TYPES: SecretType[] = [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY];

  protected override readonly bridge = new FormModelBridge<CustomProfile>([
    {form: 'customExecPath', model: 'execPath', validators: [Validators.required], defaultValue: () => ''},
    {
      form: 'auth',
      fromModel: (_value, model) => pickAuth(model, AuthType.LOGIN),
      toModel: (value, model) => mergeAuth(model, value as AuthValue),
    },
  ]);

  protected override createEmptyModel(): CustomProfile {
    return new CustomProfile();
  }
}
