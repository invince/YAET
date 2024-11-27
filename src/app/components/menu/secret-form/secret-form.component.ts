import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Secret, SecretType} from '../../../domain/Secret';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {MenuComponent} from '../menu.component';
import {IsAChildForm} from '../enhanced-form-mixin';

@Component({
  selector: 'app-secret-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatIcon,
    MatIconButton,
    MatButton,
    MatFormField,
    MatSelect,
    KeyValuePipe,
    MatInput,
    MatOption,
    MatLabel,
    MatSuffix,
    MatError,

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


  get secret(): Secret {
    return this._secret;
  }

  @Input() // input on setter, so we can combine trigger, it's easier than ngOnChange
  set secret(value: Secret) {
    this._secret = value;
    this.refreshForm(value);
  }

  constructor(private fb: FormBuilder) {
    super();
  }

  onInitForm(): FormGroup {
    return  this.fb.group(
      {
        name: [this._secret.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        secretType: [this._secret.secretType, Validators.required],
        login: [this._secret.login],
        password: [this._secret.password],
        confirmPassword: [this._secret.password],
        key: [this._secret.key],
        keyPhrase: [this._secret.keyphrase],

      },
      {validators: [this.checkCurrentSecret, this.passwordMatchValidator]}
    );

  }

  passwordMatchValidator(group: FormGroup) {
    const type = group.get('secretType')?.value;
    if ([SecretType.LOGIN_PASSWORD, SecretType.LOGIN_PASSWORD].includes(type)) {
      group.get('password')?.addValidators(Validators.required);
      group.get('confirmPassword')?.addValidators(Validators.required);

      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password === confirmPassword ? null : { passwordMismatch: true };
    } else {
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
    }
    return null;
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
        if (!group.get('key')?.value) {
          return {emptyKey: true};
        }
        break;
      }
    }
    return null;

  }

  onSelectType($event: MatSelectChange) {

  }

  shouldShowField(fieldName: string) {
    let secretType = this.form.get('secretType')?.value;
    switch (secretType) {
      case SecretType.LOGIN_PASSWORD:
        return ['login', 'password'].includes(fieldName);
      case SecretType.PASSWORD_ONLY:
        return ['password'].includes(fieldName);
      case SecretType.SSH_KEY:
        return ['key', 'keyPhrase'].includes(fieldName);

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
      this.form.reset();

      let currentSecret = this.secret;
      this.form.get('name')?.setValue(currentSecret.name);
      this.form.get('secretType')?.setValue(currentSecret.secretType);
      this.form.get('login')?.setValue(currentSecret.login);
      this.form.get('password')?.setValue(currentSecret.password);
      this.form.get('confirmPassword')?.setValue(currentSecret.password);
      this.form.get('key')?.setValue(currentSecret.key);
      this.form.get('keyphrase')?.setValue(currentSecret.keyphrase);
    }
  }

  override formToModel(): Secret {
    let secret = new Secret();
    secret.name        = this.form.get('name')?.value;
    secret.secretType  = this.form.get('secretType')?.value;
    secret.login       = this.form.get('login')?.value;
    secret.password    = this.form.get('password')?.value;
    secret.key         = this.form.get('key')?.value;
    secret.keyphrase   = this.form.get('keyphrase')?.value;
    return secret;
  }

}
