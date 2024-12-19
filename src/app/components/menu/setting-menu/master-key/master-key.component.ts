import {Component, Inject, OnInit} from '@angular/core';
import {
  MAT_DIALOG_DATA, MatDialog,
  MatDialogModule,
  MatDialogRef
} from '@angular/material/dialog';
import {MatError, MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButton} from '@angular/material/button';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ConfirmationComponent} from '../../../confirmation/confirmation.component';
import {MasterKeyService} from '../../../../services/master-key.service';

@Component({
  selector: 'app-master-key',
  standalone: true,
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
  styleUrl: './master-key.component.css'
})
export class MasterKeyComponent implements OnInit{
  resetPasswordForm: FormGroup;

  constructor(
    public masterKeyService: MasterKeyService,
    public dialogRef: MatDialogRef<MasterKeyComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private dialog: MatDialog,
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

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  async update() {
    if (this.resetPasswordForm.valid) {
      if (this.masterKeyService.hasMasterKey) {
        let willSecretsInvalid = false;
        let oldPassword = this.resetPasswordForm.get("oldPassword");
        if (oldPassword && oldPassword.value) {
          if (!await this.masterKeyService.matchMasterKey(oldPassword.value)) {
            willSecretsInvalid = true;
          }
        } else {
          willSecretsInvalid = true;
        }
        if (willSecretsInvalid) {
          this.openConfirmationDialog();
        } else {
          this.doSubmit();
        }
      } else {
        this.doSubmit();
      }
      this.dialogRef.close();
    }
  }

  doSubmit() {
    let newPassword = this.resetPasswordForm.get("newPassword");
    if (newPassword) {
      this.masterKeyService.saveMasterKey(newPassword.value);
    }
  }

  close() {
    this.dialogRef.close();
  }


  openConfirmationDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: {
        message: 'Old password doesn\'t match, if you continue, all existing secrets will be invalid. Do you want continue ?',
        okBtnLabel: 'Force Continue'
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.doSubmit();
        this.dialogRef.close();
      }
    });
  }

}
