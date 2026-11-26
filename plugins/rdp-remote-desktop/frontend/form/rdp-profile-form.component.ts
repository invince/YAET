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
import {CommonModule} from '@angular/common';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatSlideToggle} from '@angular/material/slide-toggle';
import {MatRadioChange, MatRadioModule} from '@angular/material/radio';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatDialog} from '@angular/material/dialog';
import {TranslateModule} from '@ngx-translate/core';
import {ChildFormAsFormControl} from '../../../../src/app/components/EnhancedFormMixin';
import {MenuComponent} from '../../../../src/app/components/menu/menu.component';
import {RdpProfile} from '../../../../src/app/domain/profile/RdpProfile';
import {AuthType, SecretType} from '../../../../src/app/domain/Secret';
import {SecretStorageService} from '../../../../src/app/services/secret-storage.service';
import {SecretService} from '../../../../src/app/services/secret.service';
import {
  SecretQuickFormComponent
} from '../../../../src/app/components/dialog/secret-quick-form/secret-quick-form.component';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../src/app/utils/ModelFormController';

@Component({
    selector: 'app-rdp-profile-form',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule,
        MatFormFieldModule,
        MatInput,
        MatIcon,
        MatIconButton,
        MatSlideToggle,
        MatRadioModule,
        MatSelectModule,
    ],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => RdpProfileFormComponent),
            multi: true,
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => RdpProfileFormComponent),
            multi: true,
        },
    ],
    templateUrl: './rdp-profile-form.component.html',
    styleUrl: './rdp-profile-form.component.scss'
})
export class RdpProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  AuthType = AuthType;
  AUTH_OPTIONS = [AuthType.LOGIN, AuthType.SECRET];

  private modelFormController : ModelFormController<RdpProfile>;
  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public dialog: MatDialog,
    ) {
    super();

    const mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();

    mappings.set('host',       {name: 'host', formControlOption: ['', [Validators.required]]});
    mappings.set('port',       {name: 'port', formControlOption: ['', [Validators.required]]});
    mappings.set('domain',     {name: 'domain', formControlOption: ['']});
    mappings.set('fullScreen', {name: 'fullScreen', formControlOption: ['']});
    mappings.set('asAdmin',    {name: 'asAdmin', formControlOption: ['']});
    mappings.set('authType',   {name: 'authType', formControlOption: ['']});
    mappings.set({name: 'login', precondition: form => form.get('authType')?.value === AuthType.LOGIN}, 'login');
    mappings.set({name: 'password', precondition: form => form.get('authType')?.value === AuthType.LOGIN}, 'password');
    mappings.set({name: 'secretId', precondition: form => form.get('authType')?.value === AuthType.SECRET}, 'secretId');

    this.modelFormController = new ModelFormController<RdpProfile>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb);
  }

  formToModel(): any {
    const model = this.modelFormController.formToModel(new RdpProfile(), this.form);
    if (!model.authType) {
      model.authType = AuthType.LOGIN;
    }
    if (!model.port) {
      model.port = 3389;
    }
    return model;
  }

  refreshForm(rdpProfile: any): void {
    if (this.form) {
      const profile = {...rdpProfile};
      if (!profile.authType) {
        profile.authType = AuthType.LOGIN;
      }
      if (!profile.port) {
        profile.port = 3389;
      }
      return this.modelFormController.refreshForm(profile, this.form);
    }
  }

  onSelectAuthType(_$event: MatRadioChange) {
  }

  onSelectSecret(_$event: MatSelectChange) {
  }

  quickCreateSecret() {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: {
        secretTypes: [SecretType.LOGIN_PASSWORD]
      }
    });
  }

  filterSecret() {
    return this.secretStorageService.filter(one => one.secretType === SecretType.LOGIN_PASSWORD);
  }

}
