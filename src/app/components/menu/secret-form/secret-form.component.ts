import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {Secret, SecretType} from '../../../domain/Secret';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';

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
export class SecretFormComponent implements OnInit {
  editSecretForm!: FormGroup;
  @Input() secret!: Secret;
  @Output() onSecretSave = new EventEmitter<Secret>();
  @Output() onSecretDelete = new EventEmitter<Secret>();
  @Output() onSecretCancel = new EventEmitter<Secret>();

  @Output() dirtyStateChange = new EventEmitter<boolean>();
  private lastDirtyState = false;
  SECRET_TYPE_OPTIONS = SecretType;

  unordered = (a: any, b: any) => 0

  constructor(private fb: FormBuilder) {
  }

  ngOnInit(): void {
    this.editSecretForm = this.fb.group(
      {
        name: [this.secret.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        secretType: [this.secret.secretType, Validators.required],
        login: [this.secret.login],
        password: [this.secret.password],
        key: [this.secret.key],
        keyPhrase: [this.secret.keyphrase],

      },
      {validators: [this.check]}
    );

    this.editSecretForm.valueChanges.subscribe(() => {
      const isDirty = this.editSecretForm.dirty;
      if (isDirty !== this.lastDirtyState) {
        this.lastDirtyState = isDirty;
        this.dirtyStateChange.emit(isDirty);
      }
    });
  }

  check(group: FormGroup) {
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

  clear(fieldName: string) {
    let field = this.editSecretForm.get(fieldName);
    if (field) {
      field.setValue(null);
    }
  }

  onSelectType($event: MatSelectChange) {

  }

  isShown(fieldName: string) {
    let secretType = this.editSecretForm.get('secretType')?.value;
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

  save() {
    if (this.editSecretForm.valid) {
      this.prepareModel();
      this.onSecretSave.emit(this.secret);
    }
  }

  delete() {
    this.onSecretDelete.emit(this.secret);
  }

  cancel() {
    this.onSecretCancel.emit(this.secret);
  }


  prepareModel() {
    this.secret.name = this.editSecretForm.get('name')?.value;
    this.secret.secretType = this.editSecretForm.get('secretType')?.value;
    this.secret.login = this.editSecretForm.get('login')?.value;
    this.secret.password = this.editSecretForm.get('password')?.value;
    this.secret.key = this.editSecretForm.get('key')?.value;
    this.secret.keyphrase = this.editSecretForm.get('keyphrase')?.value;
  }

}
