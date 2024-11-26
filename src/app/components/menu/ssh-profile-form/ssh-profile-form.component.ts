import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {SSHTerminalProfile} from '../../../domain/SSHTerminalProfile';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {ProfileService} from '../../../services/profile.service';
import {SecretService} from '../../../services/secret.service';
import {Secret, SecretType} from '../../../domain/Secret';
import {MenuComponent} from '../menu.component';
import {MatIconButton} from '@angular/material/button';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {IsAChildForm} from '../enhanced-form-mixin';

@Component({
  selector: 'app-ssh-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatLabel,
    MatInput,
    MatFormField,
    MatIcon,
    MatSuffix,
    MatIconButton,
    MatSelect,
    MatOption
  ],
  templateUrl: './ssh-profile-form.component.html',
  styleUrl: './ssh-profile-form.component.css'
})
export class SshProfileFormComponent extends IsAChildForm(MenuComponent)  {


  private _ssh!: SSHTerminalProfile;
  @Output() sshChange = new EventEmitter<SSHTerminalProfile>();


  constructor(
    private fb: FormBuilder,
    public secretService: SecretService,
  ) {
    super();
  }

  onInitForm(): FormGroup {
    return  this.fb.group(
      {
        host:                 [this._ssh.host, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        login:                [this._ssh.login],
        password:             [this._ssh.password],
        confirmPassword:      [this._ssh.password],
        secretId:             [this._ssh.secretId],

      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );
  }

  get ssh(): SSHTerminalProfile {
    return this._ssh;
  }
  @Input() // input on setter, so we can combine trigger, it's easier than ngOnChange
  set ssh(value: SSHTerminalProfile) {
    this._ssh = value;
    this.refreshForm();
  }

  secretOrPasswordMatchValidator(group: FormGroup) {
    const secretId = group.get('secretId')?.value;
    if (!secretId) {
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

  displaySecretOptionName(secret: Secret) {
    let label = '';
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > 6) {
        label = label.slice(0, 6) + '...';
      }
    }
    if (secret && secret.login) {
      let loginPart = secret.login;
      if (loginPart.length > 6) {
        loginPart = loginPart.slice(0, 6) + '...';
      }
      label += loginPart;
    }
    return label;
  }

  onSelectSecret($event: MatSelectChange) {
    this.form.get('password')?.setValue(null);
    this.form.get('confirmPassword')?.setValue(null);
  }

  private refreshForm() {
    if (this.form) {
      this.form.reset();

      let ssh = this.ssh;
      this.form.get('host')?.setValue(ssh.host);
      this.form.get('login')?.setValue(ssh.login);
      this.form.get('password')?.setValue(ssh.password);
      this.form.get('confirmPassword')?.setValue(ssh.password);
      this.form.get('secretId')?.setValue(ssh.secretId);
    }
  }

  formToModel(): SSHTerminalProfile {
    this.ssh.host = this.form.get('host')?.value;
    this.ssh.login = this.form.get('login')?.value;
    this.ssh.password = this.form.get('password')?.value;
    this.ssh.secretId = this.form.get('secretId')?.value;
    return this.ssh;
  }
}
