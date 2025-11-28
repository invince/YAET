import {Component, forwardRef} from '@angular/core';
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
import {CommonModule} from '@angular/common';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatRadioChange, MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {AuthType, SecretType} from '../../../../domain/Secret';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {SecretService} from '../../../../services/secret.service';
import {VncProfile} from '../../../../domain/profile/VncProfile';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {SecretQuickFormComponent} from '../../../dialog/secret-quick-form/secret-quick-form.component';
import {MatDialog} from '@angular/material/dialog';

@Component({
    selector: 'app-vnc-profile-form',
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
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => VncProfileFormComponent),
            multi: true,
        },
    ]
})
export class VncProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {
  AUTH_OPTIONS = AuthType;

  private modelFormController : ModelFormController<VncProfile>;
  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService, // in html
    public secretService: SecretService, // in html
    public settingStorage: SettingStorageService,
    public dialog: MatDialog,
  ) {
    super();

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('host' , {name: 'host', formControlOption:  ['', [Validators.required]]});
    mappings.set('port' , {name: 'port', formControlOption:  ['', [Validators.required]]});
    mappings.set('authType' , {name: 'authType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'password', precondition: form => this.form.get('authType')?.value  == 'login'} , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'secretId', precondition: form => this.form.get('authType')?.value  == 'secret' } , 'secretId');

    this.modelFormController = new ModelFormController<VncProfile>(mappings);
  }

  onInitForm(): FormGroup {
    // we shall avoid use ngModel and formControl at same time
    return this.modelFormController.onInitForm(this.fb, {validators: [this.secretOrPasswordMatchValidator]});
  }


  secretOrPasswordMatchValidator(group: FormGroup) {
    let authType = group.get('authType')?.value;
    if (authType ==  AuthType.LOGIN) {
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
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
      group.get('secretId')?.addValidators(Validators.required);
      return group.get('secretId')?.value ? null : {secretRequired: true};
    } else if (authType == AuthType.NA) {
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

  override refreshForm(vnc: any) {
    if (this.form) {
      this.modelFormController.refreshForm(vnc, this.form);
    }
  }

  override formToModel(): VncProfile {
    return this.modelFormController.formToModel(new VncProfile(), this.form);
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
        secretTypes: [ SecretType.PASSWORD_ONLY]
      }
    });
  }

  filterSecret() {
    return this.secretStorageService.filter(one => one.secretType == SecretType.PASSWORD_ONLY);

  }
}
