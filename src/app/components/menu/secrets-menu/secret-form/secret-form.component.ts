import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Secret, SecretType} from '../../../../domain/Secret';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MenuComponent} from '../../menu.component';
import {IsAChildForm} from '../../../enhanced-form-mixin';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../../utils/ModelFormController';
import {SecretStorageService} from '../../../../services/secret-storage.service';

@Component({
  selector: 'app-secret-form',
  standalone: true,
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

  private modelFormController : ModelFormController<Secret>;
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

    let mappings = new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>();
    mappings.set('name' , {name: 'name', formControlOption:  ['', [Validators.required, Validators.minLength(3)]]});
    mappings.set('secretType' , {name: 'secretType', formControlOption:  ['', [Validators.required]]});
    mappings.set({name: 'login', precondition: form => [SecretType.SSH_KEY, SecretType.LOGIN_PASSWORD].includes(this.form.get('secretType')?.value)}  , 'login');
    mappings.set({name: 'password', precondition: form => [SecretType.PASSWORD_ONLY, SecretType.LOGIN_PASSWORD].includes(this.form.get('secretType')?.value) }  , 'password');
    mappings.set({name: 'password', precondition: form => false } , 'confirmPassword'); // we don't set model.password via confirmPassword control
    mappings.set({name: 'key', precondition: form => this.form.get('secretType')?.value  == SecretType.SSH_KEY } , 'key');
    mappings.set({name: 'passphrase', precondition: form => this.form.get('secretType')?.value  == SecretType.SSH_KEY } , 'passphrase');

    this.modelFormController = new ModelFormController<Secret>(mappings);
  }

  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb, {validators: [this.secretNameShouldBeUnique(this.secretStorageService), this.checkCurrentSecret, this.passwordMatchValidator]});

  }

  passwordMatchValidator(group: FormGroup) {
    const type = group.get('secretType')?.value;
    if ([SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY].includes(type)) {
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password === confirmPassword ? null : { passwordMismatch: true };
    }
    return null;
  }

  secretNameShouldBeUnique(secretStorageService: SecretStorageService) { // NOTE: inside validatorFn, we cannot use inject thing
    return (group: FormGroup) => {
      let name = group.get("name")?.value;
      if (name && secretStorageService.data.secrets?.find(one => one.name === name && one.id !== this._secret?.id)) {
        return {duplicateSecret: true};
      }
      return null;
    }
  }

    checkCurrentSecret(group: FormGroup) {
    if (!group.dirty) {
      return null;
    }

    let secretType = group.get('secretType')?.value;
    switch (secretType) {
      case SecretType.LOGIN_PASSWORD: {
        if (!group.get('login')?.value) {
          return {emptyLogin: true};
        }
        if (!group.get('password')?.value) {
          return {emptyPassword: true};
        }
        break;
      }

      case SecretType.PASSWORD_ONLY: {
        if (!group.get('password')?.value) {
          return {emptyPassword: true};
        }
        break;
      }
      case SecretType.SSH_KEY: {
        if (!group.get('login')?.value) {
          return {emptyLogin: true};
        }
        if (!group.get('key')?.value) {
          return {emptyKey: true};
        }
        break;
      }
    }
    return null;

  }

  onSelectType($event: MatSelectChange) {
    const selectedType = $event.value;
    // Reset the form, preserving the selected type
    this.form.reset({
      name: this.form.get('name')?.value, // Preserve name if needed
      secretType: selectedType, // Set the selected type
    });

    // Optionally clear custom errors
    this.form.setErrors(null);
  }

  shouldShowField(fieldName: string) {
    let secretType = this.form.get('secretType')?.value;
    switch (secretType) {
      case SecretType.LOGIN_PASSWORD:
        return ['login', 'password'].includes(fieldName);
      case SecretType.PASSWORD_ONLY:
        return ['password'].includes(fieldName);
      case SecretType.SSH_KEY:
        return ['login', 'key', 'passphrase'].includes(fieldName);

    }
    return false;
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
