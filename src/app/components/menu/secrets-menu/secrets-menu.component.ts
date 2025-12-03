import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { MenuConsts } from '../../../domain/MenuConsts';
import { Secret, Secrets } from '../../../domain/Secret';
import { FilterKeywordPipe } from '../../../pipes/filter-keyword.pipe';
import { ModalControllerService } from '../../../services/modal-controller.service';
import { NotificationService } from '../../../services/notification.service';
import { ProfileService } from '../../../services/profile.service';
import { SecretStorageService } from '../../../services/secret-storage.service';
import { SecretService } from '../../../services/secret.service';
import { SettingStorageService } from '../../../services/setting-storage.service';
import { ConfirmationComponent } from '../../confirmation/confirmation.component';
import { HasChildForm } from '../../EnhancedFormMixin';
import { MenuComponent } from '../menu.component';
import { SecretFormComponent } from './secret-form/secret-form.component';

@Component({
  selector: 'app-secrets-menu',
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
    TranslateModule
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

    private profileService: ProfileService,
    private settingStorage: SettingStorageService,

    private notification: NotificationService,
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
      this.notification.info('Secure not loaded, we\'ll reload it, please close secure menu and reopen');
      this.secretService.reload();
    }

    this.secretsCopy = this.secretStorageService.dataCopy;
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
      this.notification.info('Please finish current form');
      return;
    }
    this.selectedId = secret.id;
    this.selectedSecret = secret;
    // this.refreshSecretForm();
  }

  async onDelete($event: Secret) {

    if (this.profileService.isSecretUsed($event)) {
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        width: '300px',
        data: { message: 'This secret is still used by some profiles. Do you want to delete this secret: ' + $event.name + '?' },
      });

      this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {

          this.profileService.clearSecret($event);
          this.secretsCopy.secrets = this.secretsCopy.secrets.filter(s => s.id !== $event.id);
          await this.commitChange();
          this.selectedId = undefined;
          this.selectedSecret = undefined;
          // this.refreshSecretForm();
        }
      }));
    } else {
      const dialogRef = this.dialog.open(ConfirmationComponent, {
        width: '300px',
        data: { message: 'Do you want to delete this secret: ' + $event.name + '?' },
      });

      this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
        if (result) {
          this.secretsCopy.secrets = this.secretsCopy.secrets.filter(s => s.id !== $event.id);
          await this.commitChange();
          this.selectedId = undefined;
          this.selectedSecret = undefined;
          // this.refreshSecretForm();
        }
      }));
    }
  }

  async onSaveOne($event: Secret) {
    this.secretService.updateOne($event);
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
    await this.secretService.saveAll(this.secretsCopy);
  }
}
