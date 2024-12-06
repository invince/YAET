import {Component,OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {AuthType, Secret} from '../../../domain/Secret';
import {CloudSettings} from '../../../domain/CloudSettings';
import {MatButtonModule} from '@angular/material/button';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {CloudService} from '../../../services/cloud.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-cloud-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatRadioModule,
    MatSelectModule,

    MatButtonModule,
    MatIcon,
    MatInput,

  ],
  templateUrl: './cloud.component.html',
  styleUrl: './cloud.component.css'
})
export class CloudComponent extends MenuComponent implements OnInit, OnDestroy {
  AUTH_OPTIONS = AuthType;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,

    public masterKeyService: MasterKeyService, // in html
    public secretStorageService: SecretStorageService, // in html
    private cloudService: CloudService,
  ) {
    super();
  }
  ngOnDestroy(): void {

  }

  ngOnInit(): void {
    let cloudSettings = this.cloudService.cloud;

    this.form = this.fb.group(
      {
        url:                  [cloudSettings.url, [Validators.required]], // we shall avoid use ngModel and formControl at same time
        authType:             [cloudSettings.authType, [Validators.required]], // we shall avoid use ngModel and formControl at same time
        login:                [cloudSettings.login],
        password:             [cloudSettings.password],
        confirmPassword:      [cloudSettings.password],
        secretId:             [cloudSettings.secretId],
      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );
  }

  secretOrPasswordMatchValidator(group: FormGroup) {
    let authType = group.get('authType')?.value;
    if (authType == 'login') {
      group.get('password')?.addValidators(Validators.required);
      group.get('confirmPassword')?.addValidators(Validators.required);
      group.get('secretId')?.removeValidators(Validators.required);
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password === confirmPassword ? null : { passwordMismatch: true };
    } else if (authType == 'secret') {
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
      group.get('secretId')?.addValidators(Validators.required);
      return group.get('secretId')?.value ? null : {secretRequired: true};
    } else {

      return {authTypeRequired: true};
    }
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
      let loginPart = '-' + secret.login;
      if (loginPart.length > 6) {
        loginPart = loginPart.slice(0, 6) + '...';
      }
      label += loginPart + '/***';
    }
    return label;
  }

  onSelectSecret($event: MatSelectChange) {
    this.form.get('password')?.setValue(null);
    this.form.get('confirmPassword')?.setValue(null);
  }

  formToModel(): CloudSettings {
    let cloud = new CloudSettings();
    cloud.url = this.form.get('url')?.value;
    cloud.authType = this.form.get('authType')?.value;
    if (cloud.authType  == 'login') {
      cloud.login = this.form.get('login')?.value;
      cloud.password = this.form.get('password')?.value;
    } else if (cloud.authType  == 'secret') {
      cloud.secretId = this.form.get('secretId')?.value;
    }
    return cloud;
  }

  upload() {
    if (this.form.valid) {
      let cloud = this.formToModel();
      this.cloudService.save(cloud).then(
        () => {
          this.cloudService.upload().then(()=> this.close());
        }
      );
    }
  }

  download() {
    this.cloudService.download().then(
      () => this.close()
    );

  }
}
