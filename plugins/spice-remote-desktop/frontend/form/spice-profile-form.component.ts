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
import {ChildFormAsFormControl} from '../../../../src/app/components/EnhancedFormMixin';
import {MenuComponent} from '../../../../src/app/components/menu/menu.component';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatRadioChange, MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {SecretStorageService} from '../../../../src/app/services/secret-storage.service';
import {SettingStorageService} from '../../../../src/app/services/setting-storage.service';
import {SecretService} from '../../../../src/app/services/secret.service';
import {SpiceProfile} from '../domain/spice-profile';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../src/app/utils/ModelFormController';
import {
  SecretQuickFormComponent
} from '../../../../src/app/components/dialog/secret-quick-form/secret-quick-form.component';
import {MatDialog} from '@angular/material/dialog';

@Component({
    selector: 'app-spice-profile-form',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        MatSelectModule,
        MatRadioModule,
        MatFormFieldModule,
        MatInput,
        MatIcon,
        MatIconButton,
        MatSlideToggle,
    ],
    templateUrl: './spice-profile-form.component.html',
    styleUrl: './spice-profile-form.component.scss',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => SpiceProfileFormComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => SpiceProfileFormComponent),
            multi: true,
        },
    ]
})
export class SpiceProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {
  AUTH_OPTIONS = AuthType;

  private modelFormController: ModelFormController<SpiceProfile>;
  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public settingStorage: SettingStorageService,
    public dialog: MatDialog,
  ) {
    super();

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('host' , {name: 'host', formControlOption: ['', [Validators.required]]});
    mappings.set('port' , {name: 'port', formControlOption: ['', [Validators.required]]});
    mappings.set('tls' , {name: 'tls'});
    mappings.set('authType' , {name: 'authType', formControlOption: ['', [Validators.required]]});
    mappings.set({name: 'password', precondition: form => this.form.get('authType')?.value == 'login'} , 'password');
    mappings.set({name: 'secretId', precondition: form => this.form.get('authType')?.value == 'secret' } , 'secretId');

    this.modelFormController = new ModelFormController<SpiceProfile>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb, {validators: [this.secretOrPasswordMatchValidator]});
  }

  secretOrPasswordMatchValidator(group: FormGroup) {
    let authType = group.get('authType')?.value;
    if (authType == AuthType.LOGIN) {
      const password = group.get('password')?.value;
      if (!password) {
        return {passwordRequired: true};
      }
      return null;
    } else if (authType == AuthType.SECRET) {
      return group.get('secretId')?.value ? null : {secretRequired: true};
    } else {
      return null;
    }
  }

  override refreshForm(spice: any) {
    if (this.form) {
      this.modelFormController.refreshForm(spice, this.form);
    }
  }

  override formToModel(): SpiceProfile {
    return this.modelFormController.formToModel(new SpiceProfile(), this.form);
  }

  onSelectAuthType(_$event: MatRadioChange) {
  }

  onSelectSecret(_$event: MatSelectChange) {
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
