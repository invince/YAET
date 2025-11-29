import {Component, forwardRef, Input} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from "@angular/forms";
import {CommonModule} from "@angular/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIcon} from "@angular/material/icon";
import {MatIconButton} from "@angular/material/button";
import {MatInput} from "@angular/material/input";
import {MatRadioModule} from "@angular/material/radio";
import {MatSelectChange, MatSelectModule} from "@angular/material/select";
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
import {SecretQuickFormComponent} from '../../../dialog/secret-quick-form/secret-quick-form.component';
import {FTPProfile} from '../../../../domain/profile/FTPProfile';
import {MatSlideToggle} from '@angular/material/slide-toggle';

@Component({
    selector: 'app-ftp-profile-form',
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
        MatSlideToggle,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => FtpProfileFormComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => FtpProfileFormComponent),
            multi: true,
        },
    ],
    templateUrl: './ftp-profile-form.component.html',
    styleUrl: './ftp-profile-form.component.css'
})
export class FtpProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  AUTH_OPTIONS = AuthType;

  @Input() type!: String;
  private modelFormController : ModelFormController<FTPProfile>;
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
    mappings.set('secured' ,'secured');
    mappings.set('initPath' , 'path');
    mappings.set('authType' , {name: 'authType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'login', precondition: form => this.form.get('authType')?.value  == 'login'} , 'login');
    mappings.set({name: 'password', precondition: form => this.form.get('authType')?.value  == 'login'} , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'secretId', precondition: form => this.form.get('authType')?.value  == 'secret' } , 'secretId');

    this.modelFormController = new ModelFormController<FTPProfile>(mappings);
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

  override formToModel(): FTPProfile {
    return this.modelFormController.formToModel(new FTPProfile(), this.form);
  }

  quickCreateSecret() {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: {
        secretTypes: [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY, SecretType.SSH_KEY]
      }
    });
  }
}
