import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatError, MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MasterKeyService} from '../../../services/master-key.service';
import {Subscription} from 'rxjs';
import {passwordMatchValidator} from '../../../utils/PasswordValidators';
import {NotificationService} from '../../../services/notification.service';

@Component({
    selector: 'app-master-key',
    imports: [
        MatDialogModule,
        MatFormFieldModule,
        MatInput,
        MatButton,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatError,
    ],
    templateUrl: './master-key.component.html',
    styleUrl: './master-key.component.scss'
})
export class MasterKeyComponent implements OnInit, OnDestroy{
  resetPasswordForm: FormGroup;
  private subscriptions: Subscription[] =[];

  constructor(
    public masterKeyService: MasterKeyService,
    public dialogRef: MatDialogRef<MasterKeyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private notification: NotificationService,
  ) {
    this.resetPasswordForm = this.fb.group(
      {
        newPassword:      ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword:  ['', Validators.required],
        oldPassword:      [''],
      },
      {validators: [this.passwordMatchValidator, this.passwordNotSimilar]}
    );
  }

  ngOnInit() {
  }

  passwordNotSimilar(group: FormGroup) {
    const password = group.get('newPassword')?.value;
    const oldPassword = group.get('oldPassword')?.value;
    if (oldPassword && password) {
      if (password.toLowerCase().includes(oldPassword.toLowerCase()) ||
        oldPassword.toLowerCase().includes(password.toLowerCase())) {
        return { passwordSimilar: true };
      }
    }
    return null;

  }

  passwordMatchValidator = (group: FormGroup) =>
    passwordMatchValidator(group, 'newPassword', 'confirmPassword');

  async update() {
    if (this.resetPasswordForm.valid) {
      const newPassword = this.resetPasswordForm.get('newPassword')?.value;
      if (this.masterKeyService.hasMasterKey) {
        const oldPassword = this.resetPasswordForm.get('oldPassword')?.value;
        // Old password required & must match when changing an existing key.
        if (!oldPassword || !await this.masterKeyService.matchMasterKey(oldPassword)) {
          this.openConfirmationDialog();
          return;
        }
        // Normal change: the MAIN process validates the old key, decrypts every
        // encrypted config with it, switches the keyring, and re-encrypts all
        // files with the new key — atomically. The renderer does NOT re-encrypt
        // from in-memory copies (that used to wipe profiles/secrets).
        const result = await this.masterKeyService.changeMasterKey(oldPassword, newPassword);
        if (result.ok) {
          this.notification.success('Master key changed and settings re-encrypted');
          this.dialogRef.close();
        } else {
          const reason = result.reason === 'mismatch'
            ? 'Old password is incorrect.'
            : result.reason === 'decrypt-failed'
              ? 'Could not decrypt saved settings with the old key.'
              : 'Failed to change master key.';
          this.notification.error(reason);
        }
      } else {
        // First-time setup: no prior data to migrate.
        this.masterKeyService.saveMasterKey(newPassword);
        this.dialogRef.close();
      }
    }
  }

  close() {
    this.dialogRef.close();
  }


  openConfirmationDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: {
        message: 'Old password is incorrect, if you continue, all existing secrets will be invalid. Do you want continue ?',
        okBtnLabel: 'Force Continue'
      },
    });

    this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        // User accepts losing old data: set the new key and clear everything.
        const newPassword = this.resetPasswordForm.get('newPassword')?.value;
        this.masterKeyService.saveMasterKey(newPassword);
        this.masterKeyService.invalidSettings();
        this.dialogRef.close();
      }
    }));
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }


}
