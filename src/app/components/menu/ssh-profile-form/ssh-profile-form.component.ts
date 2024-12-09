import {Component, forwardRef} from '@angular/core';
import {SSHTerminalProfile} from '../../../domain/profile/SSHTerminalProfile';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {FormBuilder, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule, Validators} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {AuthType, Secret} from '../../../domain/Secret';
import {MenuComponent} from '../menu.component';
import {MatIconButton} from '@angular/material/button';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {ChildFormAsFormControl} from '../../enhanced-form-mixin';
import {MatRadioModule} from '@angular/material/radio';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SettingStorageService} from '../../../services/setting-storage.service';

@Component({
  selector: 'app-ssh-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatRadioModule,
    MatFormFieldModule,

    MatInput,
    MatIcon,
    MatIconButton,
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SshProfileFormComponent),
      multi: true,
    },
  ],
  templateUrl: './ssh-profile-form.component.html',
  styleUrl: './ssh-profile-form.component.css'
})
export class SshProfileFormComponent extends ChildFormAsFormControl(MenuComponent)  {

  AUTH_OPTIONS = AuthType;

  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService,
    public settingStorage: SettingStorageService,
  ) {
    super();
  }

  onInitForm(): FormGroup {
    return  this.fb.group(
      {
        host:                 ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        port:                 ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        authType:             ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        login:                [],
        password:             [],
        confirmPassword:      [],
        secretId:             [],

      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );
  }


  secretOrPasswordMatchValidator(group: FormGroup) {
    // let authType = group.get('authType')?.value;
    // if (authType == 'login') {
    //   group.get('password')?.addValidators(Validators.required);
    //   group.get('confirmPassword')?.addValidators(Validators.required);
    //   group.get('secretId')?.removeValidators(Validators.required);
    //   const password = group.get('password')?.value;
    //   const confirmPassword = group.get('confirmPassword')?.value;
    //   return password === confirmPassword ? null : { passwordMismatch: true };
    // } else if (authType == 'secret') {
    //   group.get('password')?.removeValidators(Validators.required);
    //   group.get('confirmPassword')?.removeValidators(Validators.required);
    //   group.get('secretId')?.addValidators(Validators.required);
    //   return group.get('secretId')?.value ? null : {secretRequired: true};
    // } else {
    //
    //   return {authTypeRequired: true};
    // }
    return null;
  }

  displaySecretOptionName(secret: Secret) {
    let label = '';
    let LIMIT = this.settingStorage.settings?.ui?.secretLabelLengthInDropDown || 8;
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (secret && secret.login) {
      let loginPart = '-' + secret.login;
      if (loginPart.length > LIMIT) {
        loginPart = loginPart.slice(0, LIMIT) + '...';
      }
      label += loginPart + '/***';
    }
    return label;
  }

  onSelectSecret($event: MatSelectChange) {
    this.form.get('password')?.setValue(null);
    this.form.get('confirmPassword')?.setValue(null);
  }

  override refreshForm(ssh: any) {
    if (this.form) {
      this.form.reset();

      this.form.get('host')?.setValue(ssh?.host);
      this.form.get('port')?.setValue(ssh?.port);
      this.form.get('authType')?.setValue(ssh?.authType);
      this.form.get('login')?.setValue(ssh?.login);
      this.form.get('password')?.setValue(ssh?.password);
      this.form.get('confirmPassword')?.setValue(ssh?.password);
      this.form.get('secretId')?.setValue(ssh?.secretId);


      this.onSubmit(); // reset dirty and invalid status
    }
  }

  override formToModel(): SSHTerminalProfile {
    let ssh = new SSHTerminalProfile();
    ssh.host = this.form.get('host')?.value;
    ssh.port = this.form.get('port')?.value;
    ssh.authType = this.form.get('authType')?.value;
    if (ssh.authType  == 'login') {
      ssh.login = this.form.get('login')?.value;
      ssh.password = this.form.get('password')?.value;
    } else if (ssh.authType  == 'secret') {
      ssh.secretId = this.form.get('secretId')?.value;
    }
    return ssh;
  }
}
