import { CommonModule, KeyValuePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { Secret, SecretType } from '../../../../domain/Secret';
import { SecretStorageService } from '../../../../services/secret-storage.service';
import { ModelFormController } from '../../../../utils/ModelFormController';
import { IsAChildForm } from '../../../EnhancedFormMixin';
import { MenuComponent } from '../../menu.component';
import { SecretFormMixin } from './secretFormMixin';

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
  styleUrl: './secret-form.component.scss'
})
export class SecretFormComponent extends IsAChildForm(MenuComponent) implements OnInit {
  private _secret!: Secret;
  @Output() onSecretSave = new EventEmitter<Secret>();
  @Output() onSecretDelete = new EventEmitter<Secret>();
  @Output() onSecretCancel = new EventEmitter<Secret>();

  SECRET_TYPE_OPTIONS = SecretType;

  private modelFormController: ModelFormController<Secret>;
  get secret(): Secret {
    return this._secret;
  }

  @Input() // input on setter, so we can combine trigger, it's easier than ngOnChange
  set secret(value: Secret) {
    this._secret = value;
    this.refreshForm(value);
  }

  override afterFormInitialization() { // we cannot relay only on setter, because 1st set it before ngOnInit
    this.refreshForm(this._secret);
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
          SecretFormMixin.secretNameShouldBeUnique(this.secretStorageService, this._secret),
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
