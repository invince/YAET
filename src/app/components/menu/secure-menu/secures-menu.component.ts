import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {SecretService} from '../../../services/secret.service';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {CommonModule, SlicePipe} from '@angular/common';
import {Secret, SecretType} from '../../../domain/Secret';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatSelect, MatSelectChange} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-secure-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormField,
    MatOption,
    MatInput,
    MatSuffix,
    MatIcon,
    MatIconButton,
    MatLabel,

    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatButton,
    MatMiniFabButton,
    MatError,
    MatSelect,
  ],
  templateUrl: './secures-menu.component.html',
  styleUrl: './secures-menu.component.css'
})
export class SecuresMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  editSecretForm!: FormGroup;
  selectedIndex!: number;

  SECRET_TYPE_OPTIONS = SecretType;

  constructor(
    public secretService: SecretService,
    private fb: FormBuilder,
    private _snackBar: MatSnackBar,
    ) {
    super();
  }
  ngOnDestroy(): void {
  }

  ngOnInit(): void {
    this.initSecretForm();
  }


  addTab() {
    this.secretService.secrets.push(new Secret());
    this.selectedIndex = this.secretService.secrets.length - 1; // Focus on the newly added tab
    this.refreshSecretForm();
  }


  onTabChange(i: number) {
    if (this.selectedIndex == i) {
      return;
    }
    if (this.selectedIndex &&
        (this.editSecretForm.invalid || this.editSecretForm.dirty)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedIndex = i;
    this.refreshSecretForm();
  }

  async onDelete($event: Secret) {
    this.secretService.deleteLocal($event);
    if (!$event.isNew) {
      await this.secretService.saveAll();
    }
    this.selectedIndex = Math.min(this.selectedIndex, this.secretService.secrets.length - 1);
    this.refreshSecretForm();
  }

  async onSaveOne($event: Secret) {
    this.secretService.secrets[this.selectedIndex] = this.formToModel();
    await this.secretService.saveAll();
    this.refreshSecretForm();
  }

  onCancel($event: Secret) {
    if ($event) {
      if ($event.isNew) {
        this.secretService.deleteLocal($event);
      }
    }
    this.close();
  }

  secretTabLabel(secret: Secret, index: number) {
    let label = 'New';
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > 6) {
        label = label.slice(0, 6) + '...';
      }
    }
    if (index == this.selectedIndex && this.editSecretForm.dirty) {
      label += '*'
    }
    return label;
  }

  hasNewSecret() {
    let currentSecret = this.secretService.secrets[this.selectedIndex];
    return currentSecret?.isNew;
  }



  //============== UI SECRET FORM ===========================================
  private initSecretForm() {
    this.editSecretForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        secretType: ['', Validators.required],
        login: [],
        password: [],
        key: [],
        keyPhrase: [],

      },
      {validators: [this.checkCurrentSecret]}
    );
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


  clearField(fieldName: string) {
    let field = this.editSecretForm.get(fieldName);
    if (field) {
      field.setValue(null);
    }
  }

  shouldShowField(fieldName: string) {
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

  onSelectType($event: MatSelectChange) {

  }

  private refreshSecretForm() {
    this.editSecretForm.reset();

    let currentSecret = this.secretService.secrets[this.selectedIndex];
    this.editSecretForm.get('name')?.setValue(currentSecret.name);
    this.editSecretForm.get('secretType')?.setValue(currentSecret.secretType);
    this.editSecretForm.get('login')?.setValue(currentSecret.login);
    this.editSecretForm.get('password')?.setValue(currentSecret.password);
    this.editSecretForm.get('key')?.setValue(currentSecret.key);
    this.editSecretForm.get('keyphrase')?.setValue(currentSecret.keyphrase);

  }


  formToModel(): Secret {
    let secret = new Secret();
    secret.name        = this.editSecretForm.get('name')?.value;
    secret.secretType  = this.editSecretForm.get('secretType')?.value;
    secret.login       = this.editSecretForm.get('login')?.value;
    secret.password    = this.editSecretForm.get('password')?.value;
    secret.key         = this.editSecretForm.get('key')?.value;
    secret.keyphrase   = this.editSecretForm.get('keyphrase')?.value;
    return secret;
  }


  // reload() {
  //   this.secretService.reload();
  // }
}
