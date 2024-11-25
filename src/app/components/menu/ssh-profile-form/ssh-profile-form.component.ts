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
export class SshProfileFormComponent extends  MenuComponent implements OnInit {

  @Input() ssh!: SSHTerminalProfile;
  @Output() sshChange = new EventEmitter<SSHTerminalProfile>();

  @Output() dirtyStateChange = new EventEmitter<boolean>();
  private lastDirtyState = false;
  @Output() invalidStateChange = new EventEmitter<boolean>();
  private lastInvalidState = false;
  sshProfileForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public secretService: SecretService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.sshProfileForm = this.fb.group(
      {
        host:                 [this.ssh.host, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        login:                [this.ssh.login],
        password:             [this.ssh.password],
        confirmPassword:      [this.ssh.password],
        secretId:             [this.ssh.secretId],

      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );

    this.sshProfileForm.valueChanges.subscribe(() => {
      const isDirty = this.sshProfileForm.dirty;
      if (isDirty !== this.lastDirtyState) {
        this.lastDirtyState = isDirty;
        this.dirtyStateChange.emit(isDirty);
      }

      const invalid = this.sshProfileForm.invalid;
      if (invalid !== this.lastInvalidState) {
        this.lastInvalidState = invalid;
        this.invalidStateChange.emit(invalid);
      }
    });
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
    this.sshProfileForm.get('password')?.setValue(null);
    this.sshProfileForm.get('confirmPassword')?.setValue(null);
  }
}
