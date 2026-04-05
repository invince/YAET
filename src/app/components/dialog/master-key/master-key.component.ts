import {Component, OnDestroy, OnInit, Optional} from '@angular/core';
import {DialogService, DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {ButtonModule} from 'primeng/button';
import {InputTextModule} from 'primeng/inputtext';
import {CommonModule} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MasterKeyService} from '../../../services/master-key.service';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-master-key',
    imports: [
        ButtonModule,
        InputTextModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
    ],
    templateUrl: './master-key.component.html',
    styleUrl: './master-key.component.css'
})
export class MasterKeyComponent implements OnInit, OnDestroy{
  resetPasswordForm: FormGroup;
  private subscriptions: Subscription[] =[];

  constructor(
    public masterKeyService: MasterKeyService,
    @Optional() public ref: DynamicDialogRef,
    @Optional() public config: DynamicDialogConfig,
    private fb: FormBuilder,
    public dialogService: DialogService,
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
          this.ref?.close();
        }
      } else {
        this.doSubmit(false);
        this.ref?.close();
      }
    }
  }

  doSubmit(suggestReencrypt = true) {
    let newPassword = this.resetPasswordForm.get("newPassword");
    if (newPassword) {
      this.masterKeyService.saveMasterKey(newPassword.value, suggestReencrypt);
    }
  }

  close() {
    this.ref?.close();
  }


  openConfirmationDialog(): void {
    const dialogRef = this.dialogService.open(ConfirmationComponent, {
      header: 'Confirm',
      width: '300px',
      data: {
        message: 'Old password is incorrect, if you continue, all existing secrets will be invalid. Do you want continue ?',
        okBtnLabel: 'Force Continue'
      },
    });

    if (dialogRef) {
        this.subscriptions.push(dialogRef.onClose.subscribe((result) => {
          if (result) {
            this.doSubmit(false);
            this.masterKeyService.invalidSettings();
            this.ref?.close();
          }
        }));
    }
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }


}
