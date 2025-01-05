import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {AuthType, SecretType} from '../../../domain/Secret';
import {CloudSettings} from '../../../domain/setting/CloudSettings';
import {MatButtonModule} from '@angular/material/button';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {CloudService} from '../../../services/cloud.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {CommonModule} from '@angular/common';
import {MatListModule} from '@angular/material/list';
import {MatCheckbox} from '@angular/material/checkbox';
import {SecretService} from '../../../services/secret.service';
import {SettingService} from '../../../services/setting.service';
import {ProfileService} from '../../../services/profile.service';
import {NgxSpinnerService} from 'ngx-spinner';
import _ from 'lodash';
import {NotificationService} from '../../../services/notification.service';

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
    MatListModule,

    MatButtonModule,
    MatIcon,
    MatInput,
    MatCheckbox,

  ],
  templateUrl: './cloud.component.html',
  styleUrl: './cloud.component.css'
})
export class CloudComponent extends MenuComponent implements OnInit, OnDestroy {
  AUTH_OPTIONS = AuthType;

  SYNC_ITEMS = CloudService.OPTIONS;

  allSelected = false;
  indeterminateState = false;

  processing = false;

  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    public masterKeyService: MasterKeyService, // in html
    public secretStorageService: SecretStorageService, // in html

    public secretService: SecretService,
    private settingService: SettingService,
    private profileService: ProfileService,
    private cloudService: CloudService,
    private notification: NotificationService,

    private spinner: NgxSpinnerService
  ) {
      super();
  }

  ngOnDestroy(): void {

  }

  ngOnInit(): void {
    if (!this.cloudService.isLoaded ) {
      this.notification.info('Cloud Setting not loaded, we\'ll reload it, please close Cloud menu and reopen');
      this.cloudService.reload();
    }

    let cloudSettings = this.cloudService.cloud;

    this.form = this.fb.group(
      {
        url: [cloudSettings.url, [Validators.required]], // we shall avoid use ngModel and formControl at same time
        items: [cloudSettings.items],

        authType: [cloudSettings.authType, [Validators.required]], // we shall avoid use ngModel and formControl at same time
        login: [cloudSettings.login],
        password: [cloudSettings.password],
        confirmPassword: [cloudSettings.password],
        secretId: [cloudSettings.secretId],
      },
      {validators: [this.secretOrPasswordMatchValidator]}
    );

    this.allSelected = _.isEqual(cloudSettings.items, this.SYNC_ITEMS);
  }

  toggleAll(event: any) {
    const isChecked = event.checked;
    this.allSelected = isChecked;
    this.indeterminateState = false;
    if (isChecked) {
      this.form?.get('items')?.setValue(this.SYNC_ITEMS);
    } else {
      this.form?.get('items')?.setValue([]);
    }
  }

  secretOrPasswordMatchValidator(group: FormGroup) {
    let authType = group.get('authType')?.value;
    if (authType == 'login') {
      group.get('password')?.addValidators(Validators.required);
      group.get('confirmPassword')?.addValidators(Validators.required);
      group.get('secretId')?.removeValidators(Validators.required);
      const password = group.get('password')?.value;
      const confirmPassword = group.get('confirmPassword')?.value;
      return password === confirmPassword ? null : {passwordMismatch: true};
    } else if (authType == 'secret') {
      group.get('password')?.removeValidators(Validators.required);
      group.get('confirmPassword')?.removeValidators(Validators.required);
      group.get('secretId')?.addValidators(Validators.required);
      return group.get('secretId')?.value ? null : {secretRequired: true};
    } else {

      return {authTypeRequired: true};
    }
  }

  onSelectSecret($event: MatSelectChange) {
    this.form.get('password')?.setValue(null);
    this.form.get('confirmPassword')?.setValue(null);
  }

  formToModel(): CloudSettings {
    let cloud = new CloudSettings();
    cloud.url = this.form.get('url')?.value;
    cloud.authType = this.form.get('authType')?.value;
    cloud.items = this.form.get('items')?.value;
    if (cloud.authType == 'login') {
      cloud.login = this.form.get('login')?.value;
      cloud.password = this.form.get('password')?.value;
    } else if (cloud.authType == 'secret') {
      cloud.secretId = this.form.get('secretId')?.value;
    }
    return cloud;
  }

  upload() {
    if (this.form.valid) {
      this.processing = true;
      this.spinner.show();
      let cloud = this.formToModel();
      this.cloudService.save(cloud).then(
        () => {
          this.cloudService.upload(cloud).then((response) => {
            this.spinner.hide();
            if (response) {
              if (response.succeed) {
                this.notification.info('Uploaded');
              } else {
                this.notification.error('Error Occurred: ' + response.ko);
                this.processing = false;
              }
            }
          });
        }
      );
    }
  }

  download() {
    if (this.form.valid) {
      this.spinner.show();
      this.processing = true;
      let cloud = this.formToModel();
      this.cloudService.save(cloud).then(
        () => {
          this.cloudService.download(cloud).then((response) => {
            this.spinner.hide();
            if (response) {
              if (response.succeed) {
                this.notification.info('Downloaded');
                for (const item of cloud.items) {
                  if (item.toLowerCase() == SettingService.CLOUD_OPTION.toLowerCase()) {
                    this.settingService.reload();
                  }
                  if (item.toLowerCase() == ProfileService.CLOUD_OPTION.toLowerCase()) {
                    this.profileService.reload();
                  }
                  if (item.toLowerCase() == SecretService.CLOUD_OPTION.toLowerCase()) {
                    this.secretService.reload();
                  }
                }
                this.processing = false;
              } else {
                this.notification.error('Error Occurred: ' + response.ko);
                this.processing = false;
              }
            }
          })
        });
    }
  }

  getItemControlName(item: string) {
    return 'items_' + item;
  }

  filterSecret() {
    return this.secretStorageService.data.secrets?.filter(one => one.secretType == SecretType.LOGIN_PASSWORD);
  }
}
