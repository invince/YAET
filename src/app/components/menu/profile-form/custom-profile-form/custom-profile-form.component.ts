import {Component, forwardRef, Injector} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatRadioChange, MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {ChildFormAsFormControl} from '../../../enhanced-form-mixin';
import {MenuComponent} from '../../menu.component';
import {AuthType, SecretType} from '../../../../domain/Secret';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {SecretService} from '../../../../services/secret.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {CustomProfile} from '../../../../domain/profile/CustomProfile';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {SecretQuickFormComponent} from '../../../dialog/secret-quick-form/secret-quick-form.component';
import {MatDialog} from '@angular/material/dialog';

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
    CdkTextareaAutosize,

  ],
  templateUrl: './custom-profile-form.component.html',
  styleUrl: './custom-profile-form.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomProfileFormComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CustomProfileFormComponent),
      multi: true,
    },
  ],
})
export class CustomProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {
  AUTH_OPTIONS = AuthType;

  private modelFormController : ModelFormController<CustomProfile>;

  constructor(

    private injector: Injector, // we shall inject ngControl after constructor, it cannot coexist with NG_VALUE_ACCESSOR, this creates circular dependency
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService, // in html
    public secretService: SecretService, // in html
    public settingStorage: SettingStorageService,
    public dialog: MatDialog,
  ) {
    super();

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();

    mappings.set('execPath' , {name: 'customExecPath', formControlOption:  ['', [Validators.required]]});
    mappings.set('authType' , {name: 'authType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'login', precondition: form => this.form.get('authType')?.value  == 'login'}    , 'login');
    mappings.set({name: 'password', precondition: form => this.form.get('authType')?.value  == 'login'} , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'secretId', precondition: form => this.form.get('authType')?.value  == 'secret' } , 'secretId');


    this.modelFormController = new ModelFormController<CustomProfile>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb, {validators: [this.secretOrPasswordMatchValidator]});
  }


  secretOrPasswordMatchValidator(group: FormGroup) {
    let authType = group.get('authType')?.value;
    if (authType ==  AuthType.LOGIN) {
      group.get('login')?.addValidators(Validators.required);
      group.get('password')?.addValidators(Validators.required);
      group.get('confirmPassword')?.addValidators(Validators.required);
      group.get('secretId')?.removeValidators(Validators.required);
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      if (!password) {
        return {passwordRequired: true};
      }
      return password === confirmPassword ? null : { passwordMismatch: true };
    } else if (authType ==  AuthType.SECRET) {
      group.get('login')?.removeValidators(Validators.required);
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
      group.get('secretId')?.addValidators(Validators.required);
      return group.get('secretId')?.value ? null : {secretRequired: true};
    } else if (authType == AuthType.NA) {
      group.get('login')?.removeValidators(Validators.required);
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
      group.get('secretId')?.removeValidators(Validators.required);
      return {};
    }
    return {};
  }

  onSelectSecret($event: MatSelectChange) {
    // this.form.get('password')?.setValue(null);
    // this.form.get('confirmPassword')?.setValue(null);
  }

  override refreshForm(custom: any) {
    if (this.form) {
      this.modelFormController.refreshForm(custom, this.form);
    }
  }

  override formToModel(): CustomProfile {
    return this.modelFormController.formToModel(new CustomProfile(), this.form);
  }

  onSelectAuthType($event: MatRadioChange) {
    let authType = $event.value;
    if (authType ==  AuthType.LOGIN) {
      this.form.get('secretId')?.setValue(null);
    } else if (authType ==  AuthType.SECRET) {
      this.form.get('password')?.setValue(null);
      this.form.get('confirmPassword')?.setValue(null);
    } else if (authType == AuthType.NA) {
      this.form.get('password')?.setValue(null);
      this.form.get('confirmPassword')?.setValue(null);
      this.form.get('secretId')?.setValue(null);
    }
  }

  quickCreateSecret() {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: {
        secretTypes: [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY]
      }
    });
  }

  filterSecret() {
    return this.secretStorageService.filter(one => one.secretType == SecretType.LOGIN_PASSWORD || one.secretType == SecretType.PASSWORD_ONLY);
  }
}
