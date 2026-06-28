import {Component, forwardRef, Input} from '@angular/core';
import {
  ControlValueAccessor,
  FormBuilder,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {MatRadioModule} from '@angular/material/radio';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {MatSelectModule} from '@angular/material/select';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SecretService} from '../../../services/secret.service';
import {Secret, SecretType} from '../../../domain/Secret';
import {MatDialog} from '@angular/material/dialog';
import {SecretQuickFormComponent} from '../../dialog/secret-quick-form/secret-quick-form.component';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatIconButton,
    MatSelectModule,
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => AuthFormComponent),
    multi: true,
  }],
  template: `
    <div [formGroup]="form" class="auth-form">
      <mat-radio-group aria-label="Auth Type" formControlName="authType" required>
        @for (opt of authOptions; track opt) {
          <mat-radio-button [value]="opt">
            {{ opt === 'N/A' ? ('COMMON.NONE' | translate) : opt === 'login' ? ('COMMON.LOGIN' | translate) : ('COMMON.SECRET' | translate) }}
          </mat-radio-button>
        }
      </mat-radio-group>

      @switch (form.get('authType')?.value) {
        @case ('login') {
          @if (!hideLogin) {
          <mat-form-field class="field">
            <mat-label>{{ 'COMMON.LOGIN' | translate }}</mat-label>
            <input matInput type="text" formControlName="login" />
            @if (form.get('login')?.value) {
              <button matSuffix mat-icon-button (click)="clear('login')"><mat-icon>close</mat-icon></button>
            }
          </mat-form-field>
          }

          <mat-form-field class="field">
            <mat-label>{{ 'COMMON.PASSWORD' | translate }}</mat-label>
            <input matInput type="password" formControlName="password" />
            @if (form.get('password')?.value) {
              <button matSuffix mat-icon-button (click)="clear('password')"><mat-icon>close</mat-icon></button>
            }
          </mat-form-field>
        }

        @case ('secret') {
          <mat-form-field class="field">
            <mat-label>{{ 'COMMON.SECRET' | translate }}</mat-label>
            <mat-select formControlName="secretId">
              <mat-option (click)="quickCreateSecret()">
                <mat-icon>add</mat-icon>
                {{ 'COMMON.ADD_NEW' | translate }}
              </mat-option>
              @for (oneSecret of filterSecret(); track oneSecret.id) {
                <mat-option [value]="oneSecret.id">
                  @if (oneSecret.icon) { <mat-icon>{{oneSecret.icon}}</mat-icon> }
                  {{ secretService.displaySecretOptionName(oneSecret) }}
                </mat-option>
              }
            </mat-select>
            @if (form.get('secretId')?.value) {
              <button matSuffix mat-icon-button (click)="clear('secretId')"><mat-icon>close</mat-icon></button>
            }
          </mat-form-field>
        }
      }
    </div>
  `,
  styles: [`
    .auth-form { display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box }
    .field { width:100% }
    mat-radio-group { display:flex;gap:12px;padding:4px 0 }
  `]
})
export class AuthFormComponent implements ControlValueAccessor {
  @Input() supportedAuthTypes: string[] = ['N/A', 'login', 'secret'];
  @Input() secretTypes: SecretType[] = [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY];
  @Input() hideLogin = false;

  authOptions = this.supportedAuthTypes;
  form: FormGroup;

  private _onChange: any = () => {};
  private _onTouched: any = () => {};

  constructor(
    private fb: FormBuilder,
    public secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public dialog: MatDialog,
  ) {
    this.form = this.fb.group({
      authType: ['N/A', Validators.required],
      login: [''],
      password: [''],
      secretId: [''],
    });
    this.form.valueChanges.subscribe(() => this._onChange(this._getValue()));
  }

  _getValue(): any {
    const raw = this.form.value;
    const authType = raw.authType || 'N/A';
    const result: any = { authType };
    if (authType === 'login') {
      result.login = raw.login || '';
      result.password = raw.password || '';
    } else if (authType === 'secret') {
      result.secretId = raw.secretId || '';
    }
    return result;
  }

  writeValue(obj: any): void {
    if (!obj) {
      this.form.reset({ authType: 'N/A', login: '', password: '', secretId: '' });
      return;
    }
    this.form.patchValue({
      authType: obj.authType || 'N/A',
      login: obj.login || '',
      password: obj.password || '',
      secretId: obj.secretId || '',
    }, { emitEvent: false });
  }

  registerOnChange(fn: any): void { this._onChange = fn; }
  registerOnTouched(fn: any): void { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.form.disable(); else this.form.enable();
  }

  clear(field: string): void {
    this.form.get(field)?.setValue('');
    this.form.markAsDirty();
  }

  quickCreateSecret(): void {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: { secretTypes: this.secretTypes },
    });
  }

  filterSecret(): Secret[] {
    return this.secretStorageService.dataCopy.secrets.filter(
      s => this.secretTypes.includes(s.secretType)
    );
  }
}
