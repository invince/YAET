import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {SecretService} from '../../../services/secret.service';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {Secret, Secrets} from '../../../domain/Secret';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatSelectModule} from '@angular/material/select';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SecretFormComponent} from './secret-form/secret-form.component';
import {HasChildForm} from '../../enhanced-form-mixin';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {Subscription} from 'rxjs';
import {FilterKeywordPipe} from '../../../pipes/filter-keyword.pipe';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MatDialog} from '@angular/material/dialog';
import {ModalControllerService} from '../../../services/modal-controller.service';
import {MenuConsts} from '../../../domain/MenuConsts';

@Component({
  selector: 'app-secrets-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatButtonModule,
    MatSidenavModule,
    MatSelectModule,

    MatInput,
    MatIcon,
    SecretFormComponent,

    FilterKeywordPipe,
  ],
  templateUrl: './secrets-menu.component.html',
  styleUrl: './secrets-menu.component.scss',
  providers: [FilterKeywordPipe]
})
export class SecretsMenuComponent extends HasChildForm(MenuComponent) implements OnInit, OnDestroy {

  selectedId!: string | undefined;
  selectedSecret!: Secret | undefined;
  subscriptions: Subscription[] = [];
  filter!: string;

  secretsCopy!: Secrets;

  keywordsProviders: ((secret: Secret) => string | string[])[] = [
    (secret: Secret) => secret.name,
    (secret: Secret) => secret.secretType,
    (secret: Secret) => secret.login,
  ];

  constructor(
    public secretService: SecretService,
    public secretStorageService: SecretStorageService,

    private settingStorage: SettingStorageService,

    private _snackBar: MatSnackBar,
    private keywordPipe: FilterKeywordPipe,
    private dialog: MatDialog,

    private modalControl: ModalControllerService,
    ) {
    super();
  }
  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }


  ngOnInit(): void {
    this.subscriptions.push(this.modalControl.modalCloseEvent.subscribe(one => {
      if (one && one.includes(MenuConsts.MENU_SECURE)) {
        this.modalControl.closeModal();
      }
    }));
    if (!this.secretService.isLoaded) {
      this._snackBar.open('Secure not loaded, we\'ll reload it, please close secure menu and reopen', 'OK', {
        duration: 3000
      });
      this.secretService.reload();
    }

    this.secretsCopy = this.secretStorageService.data;
    this.secretsCopy.secrets = this.secretsCopy.secrets.sort((a: Secret, b: Secret) => a.name.localeCompare(b.name));
  }

  addTab() {
    let secret = new Secret();
    this.secretsCopy.secrets.push(secret);
    this.selectedId = secret.id;
    this.selectedSecret = secret;
    // this.refreshSecretForm();
  }


  onTabChange(secret: Secret) {
    if (!secret) {
      return;
    }

    if (this.selectedId == secret.id) {
      this.selectedSecret = secret;
      return;
    }
    if (this.selectedId &&
        (this.lastChildFormInvalidState || this.lastChildFormDirtyState)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedId = secret.id;
    this.selectedSecret = secret;
    // this.refreshSecretForm();
  }

  async onDelete($event: Secret) {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: 'Do you want to delete this profile: ' + $event.name + '?' },
    });

    this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.secretsCopy.delete($event);
        await this.commitChange();
        this.selectedId = undefined;
        this.selectedSecret = undefined;
        // this.refreshSecretForm();
      }
    }));
  }

  async onSaveOne($event: Secret) {
    this.secretsCopy.update($event);
    await this.commitChange();
    // this.refreshSecretForm();
  }

  onCancel($event: Secret) {
    this.close();
  }

  secretTabLabel(secret: Secret) {
    let LIMIT = this.settingStorage.settings?.ui?.secretLabelLength || 10;
    let label = 'New';
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (secret.id == this.selectedId && this.lastChildFormDirtyState) {
      label += '*'
    }
    return label;
  }

  hasNewSecret() {
    return this.selectedSecret?.isNew;
  }

  async commitChange() {
    await this.secretService.save(this.secretsCopy);
  }
}
