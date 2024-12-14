import {Component, forwardRef} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule, Validators} from '@angular/forms';
import {ChildFormAsFormControl} from '../../../enhanced-form-mixin';
import {MenuComponent} from '../../menu.component';
import {CommonModule} from '@angular/common';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {AuthType, Secret} from '../../../../domain/Secret';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {SecretService} from '../../../../services/secret.service';
import {VncProfile} from '../../../../domain/profile/VncProfile';

@Component({
  selector: 'app-vnc-profile-form',
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
  templateUrl: './vnc-profile-form.component.html',
  styleUrl: './vnc-profile-form.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => VncProfileFormComponent),
      multi: true,
    },
  ],
})
export class VncProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {
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
        host:                 ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        port:                 ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
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

  override refreshForm(vnc: any) {
    if (this.form) {
      this.form.reset();

      this.form.get('host')?.setValue(vnc?.host);
      this.form.get('port')?.setValue(vnc?.port);
      this.form.get('authType')?.setValue(vnc?.authType);
      this.form.get('password')?.setValue(vnc?.password);
      this.form.get('confirmPassword')?.setValue(vnc?.password);
      this.form.get('secretId')?.setValue(vnc?.secretId);


      this.onSubmit(); // reset dirty and invalid status
    }
  }

  override formToModel(): VncProfile {
    let vnc = new VncProfile();
    vnc.host = this.form.get('host')?.value;
    vnc.port = this.form.get('port')?.value;
    vnc.authType = this.form.get('authType')?.value;
    if (vnc.authType  == 'login') {
      vnc.password = this.form.get('password')?.value;
    } else if (vnc.authType  == 'secret') {
      vnc.secretId = this.form.get('secretId')?.value;
    }
    return vnc;
  }

}
