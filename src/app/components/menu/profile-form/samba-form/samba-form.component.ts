import {Component, forwardRef, Input} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {ChildFormAsFormControl} from '../../../EnhancedFormMixin';
import {MenuComponent} from '../../menu.component';
import {AuthType, SecretType} from '../../../../domain/Secret';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {SecretService} from '../../../../services/secret.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {MatDialog} from '@angular/material/dialog';
import {MatFormField, MatLabel, MatOption, MatSelect, MatSelectChange, MatSuffix} from '@angular/material/select';
import {SecretQuickFormComponent} from '../../../dialog/secret-quick-form/secret-quick-form.component';
import {SambaProfile} from '../../../../domain/profile/SambaProfile';
import {KeyValuePipe} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatInput} from '@angular/material/input';
import {MatRadioButton, MatRadioGroup} from '@angular/material/radio';

@Component({
  selector: 'app-samba-form',
  standalone: true,
  imports: [
    FormsModule,
    KeyValuePipe,
    MatFormField,
    MatIcon,
    MatIconButton,
    MatInput,
    MatLabel,
    MatOption,
    MatRadioButton,
    MatRadioGroup,
    MatSelect,
    MatSuffix,
    ReactiveFormsModule
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SambaFormComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SambaFormComponent),
      multi: true,
    },
  ],
  templateUrl: './samba-form.component.html',
  styleUrl: './samba-form.component.css'
})
export class SambaFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  AUTH_OPTIONS = AuthType;

  @Input() type!: String;
  private modelFormController : ModelFormController<SambaProfile>;
  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService, // in html

    public secretService: SecretService, // in html
    public settingStorage: SettingStorageService,

    public dialog: MatDialog,
  ) {
    super();

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('share' , {name: 'share', formControlOption:  ['', [Validators.required]]});
    mappings.set('port' , {name: 'port', formControlOption:  ['', [Validators.required]]});
    mappings.set('domain' ,'domain');
    mappings.set('authType' , {name: 'authType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'login', precondition: form => this.form.get('authType')?.value  == 'login'} , 'login');
    mappings.set({name: 'password', precondition: form => this.form.get('authType')?.value  == 'login'} , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'secretId', precondition: form => this.form.get('authType')?.value  == 'secret' } , 'secretId');

    this.modelFormController = new ModelFormController<SambaProfile>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb, {validators: [this.secretOrPasswordMatchValidator]});  // we shall avoid use ngModel and formControl at same time
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

  override refreshForm(ssh: any) {
    if (this.form) {
      this.modelFormController.refreshForm(ssh, this.form);
    }
  }

  override formToModel(): SambaProfile {
    return this.modelFormController.formToModel(new SambaProfile(), this.form);
  }

  quickCreateSecret() {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: {
        secretTypes: [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY]
      }
    });
  }

}
