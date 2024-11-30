import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {SecretService} from '../../../services/secret.service';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {Secret} from '../../../domain/Secret';
import {FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MatSelect} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SecretFormComponent} from '../secret-form/secret-form.component';
import {HasChildForm} from '../enhanced-form-mixin';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SettingService} from '../../../services/setting.service';
import {SettingStorageService} from '../../../services/setting-storage.service';

@Component({
  selector: 'app-secures-menu',
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
    SecretFormComponent,
  ],
  templateUrl: './secures-menu.component.html',
  styleUrl: './secures-menu.component.css'
})
export class SecuresMenuComponent extends HasChildForm(MenuComponent) implements OnInit, OnDestroy {

  selectedIndex!: number;
  constructor(
    public secretService: SecretService,
    public secretStorageService: SecretStorageService,

    private settingStorage: SettingStorageService,
    private _snackBar: MatSnackBar,
    ) {
    super();
  }
  ngOnDestroy(): void {
  }

  ngOnInit(): void {
  }


  addTab() {
    this.secretStorageService.secrets.push(new Secret());
    this.selectedIndex = this.secretStorageService.secrets.length - 1; // Focus on the newly added tab
    // this.refreshSecretForm();
  }


  onTabChange(i: number) {
    if (this.selectedIndex == i) {
      return;
    }
    if (this.selectedIndex &&
        (this.lastChildFormInvalidState || this.lastChildFormDirtyState)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedIndex = i;
    // this.refreshSecretForm();
  }

  async onDelete($event: Secret) {
    this.secretService.deleteLocal($event);
    if (!$event.isNew) {
      await this.secretService.saveAll();
    }
    this.selectedIndex = Math.min(this.selectedIndex, this.secretStorageService.secrets.length - 1);
    // this.refreshSecretForm();
  }

  async onSaveOne($event: Secret) {
    this.secretStorageService.secrets[this.selectedIndex] = $event;
    await this.secretService.saveAll();
    // this.refreshSecretForm();
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
    let LIMIT = this.settingStorage.settings?.ui?.secretLabelLength || 10;
    let label = 'New';
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (index == this.selectedIndex && this.lastChildFormDirtyState) {
      label += '*'
    }
    return label;
  }

  hasNewSecret() {
    let currentSecret = this.secretStorageService.secrets[this.selectedIndex];
    return currentSecret?.isNew;
  }
}
