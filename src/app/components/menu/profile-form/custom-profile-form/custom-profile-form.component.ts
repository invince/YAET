import {Component, forwardRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {ChildFormAsFormControl} from '../../../enhanced-form-mixin';
import {MenuComponent} from '../../menu.component';
import {AuthType} from '../../../../domain/Secret';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {SecretService} from '../../../../services/secret.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {CustomProfile} from '../../../../domain/profile/CustomProfile';

@Component({
  selector: 'app-custom-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatRadioModule,
    MatFormFieldModule,

    MatInput,
    MatIcon,
    MatIconButton,

  ],
  templateUrl: './custom-profile-form.component.html',
  styleUrl: './custom-profile-form.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomProfileFormComponent),
      multi: true,
    },
  ],
})
export class CustomProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {
  AUTH_OPTIONS = AuthType;

  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService, // in html
    public secretService: SecretService, // in html
    public settingStorage: SettingStorageService,
  ) {
    super();
  }

  onInitForm(): FormGroup {
    return  this.fb.group(
      {
        customExecPath:       ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        authType:             ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        login:                [],
        password:             [],
        confirmPassword:      [],
        secretId:             [],

      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );
  }


  secretOrPasswordMatchValidator(group: FormGroup) {
    // let authType = group.get('authType')?.value;
    // if (authType == 'login') {
    //   group.get('password')?.addValidators(Validators.required);
    //   group.get('confirmPassword')?.addValidators(Validators.required);
    //   group.get('secretId')?.removeValidators(Validators.required);
    //   const password = group.get('password')?.value;
    //   const confirmPassword = group.get('confirmPassword')?.value;
    //   return password === confirmPassword ? null : { passwordMismatch: true };
    // } else if (authType == 'secret') {
    //   group.get('password')?.removeValidators(Validators.required);
    //   group.get('confirmPassword')?.removeValidators(Validators.required);
    //   group.get('secretId')?.addValidators(Validators.required);
    //   return group.get('secretId')?.value ? null : {secretRequired: true};
    // } else {
    //
    //   return {authTypeRequired: true};
    // }
    return null;
  }

  onSelectSecret($event: MatSelectChange) {
    this.form.get('password')?.setValue(null);
    this.form.get('confirmPassword')?.setValue(null);
  }

  override refreshForm(custom: any) {
    if (this.form) {
      this.form.reset();

      this.form.get('customExecPath')?.setValue(custom?.host);
      this.form.get('authType')?.setValue(custom?.authType);
      this.form.get('password')?.setValue(custom?.password);
      this.form.get('confirmPassword')?.setValue(custom?.password);
      this.form.get('secretId')?.setValue(custom?.secretId);


      this.onSubmit(); // reset dirty and invalid status
    }
  }

  override formToModel(): CustomProfile {
    let custom = new CustomProfile();
    custom.execPath = this.form.get('customExecPath')?.value;
    custom.authType = this.form.get('authType')?.value;
    if (custom.authType  == 'login') {
      custom.password = this.form.get('password')?.value;
    } else if (custom.authType  == 'secret') {
      custom.secretId = this.form.get('secretId')?.value;
    }
    return custom;
  }
}
