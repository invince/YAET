import {CommonModule, KeyValuePipe} from '@angular/common';
import {Component, EventEmitter, forwardRef, OnInit, Output} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {TranslateModule} from '@ngx-translate/core';
import {Secret, SecretType} from '../../../../domain/Secret';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {ModelFormController} from '../../../../utils/ModelFormController';
import {ChildFormAsFormControl} from '../../../EnhancedFormMixin';
import {MenuComponent} from '../../menu.component';
import {SecretFormMixin} from './secretFormMixin';

@Component({
  selector: 'app-secret-form',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    KeyValuePipe,
    MatInput,
    TranslateModule
  ],
  templateUrl: './secret-form.component.html',
  styleUrl: './secret-form.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SecretFormComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => SecretFormComponent), multi: true }
  ]
})
export class SecretFormComponent extends ChildFormAsFormControl(MenuComponent) implements OnInit {
  private _secret!: Secret;
  @Output() onSecretSave = new EventEmitter<Secret>();
  @Output() onSecretDelete = new EventEmitter<Secret>();
  @Output() onSecretCancel = new EventEmitter<Secret>();

  SECRET_TYPE_OPTIONS = SecretType;

  private modelFormController: ModelFormController<Secret>;
  get secret(): Secret {
    return this._secret;
  }

  // CVA overrides Instead of @Input
  override writeValue(value: Secret): void {
    if (value) {
      this._secret = value;
      super.writeValue(value);
    }
  }

  constructor(
    private fb: FormBuilder,
    private secretStorageService: SecretStorageService,

  ) {
    super();
    this.modelFormController = SecretFormMixin.generateModelForm();
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb,
      {
        validators: [
          SecretFormMixin.secretNameShouldBeUnique(this.secretStorageService, () => this._secret),
          SecretFormMixin.checkCurrentSecret,
          SecretFormMixin.passwordMatchValidator
        ]
      });

  }


  onSelectType($event: MatSelectChange) {
    SecretFormMixin.onSelectType(this.form, $event);
  }

  shouldShowField(fieldName: string) {
    return SecretFormMixin.shouldShowField(this.form, fieldName);
  }

  onSaveOne() {
    if (this.form.valid) {
      this._secret = this.formToModel();
      // Reset the dirty state
      this.onSubmit();
      this.onSecretSave.emit(this._secret);
    }
  }

  onDelete() {
    this.onSecretDelete.emit(this._secret);
  }

  onCancel() {
    this.onSecretCancel.emit(this._secret);
  }

  override refreshForm(value: any) {
    if (this.form) {
      this.modelFormController.refreshForm(this._secret, this.form);
    }
  }

  override formToModel(): Secret {
    if (!this._secret) {
      this._secret = new Secret();
    }
    return this.modelFormController.formToModel(this._secret, this.form);
  }

}
