import {Component, forwardRef, inject, Injector, OnDestroy, OnInit, Provider, Type} from '@angular/core';
import {
  AbstractControl,
  AbstractControlOptions,
  ControlValueAccessor,
  FormBuilder,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import {Subscription} from 'rxjs';
import {MenuComponent} from '../menu/menu.component';
import {FormModelBridge} from '../../utils/model-form.bridge';

export interface ValidationIssue {
  field: string;
  code: string;
}

export function profileFormProviders<T>(type: () => Type<T>): Provider[] {
  return [
    {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(type), multi: true},
    {provide: NG_VALIDATORS, useExisting: forwardRef(type), multi: true},
  ];
}

const ERROR_KEYS: Record<string, string> = {
  required: 'VALIDATION.REQUIRED',
  passwordRequired: 'VALIDATION.PASSWORD_REQUIRED',
  secretRequired: 'VALIDATION.SECRET_REQUIRED',
  loginRequired: 'VALIDATION.LOGIN_REQUIRED',
  invalidChildForm: 'VALIDATION.INVALID_CHILD_FORM',
};

@Component({selector: 'app-profile-form-base', standalone: true, template: ''})
export abstract class ProfileFormBase<T extends object> extends MenuComponent
  implements OnInit, OnDestroy, ControlValueAccessor, Validator {

  form!: FormGroup;

  protected readonly fb = inject(FormBuilder);
  protected readonly subscriptions: Subscription[] = [];
  protected abstract readonly bridge: FormModelBridge<T>;

  private readonly injector = inject(Injector);
  private _ngControl: NgControl | null | undefined;
  private _writing = false;
  private _baseline: T | undefined;
  private _hasBaseline = false;
  private _pendingValue: T | null | undefined;
  private _hasPendingValue = false;
  private onChange: (value: T) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.form = this.bridge.createForm(this.fb, this.getFormOptions());
    this.afterFormInitialization();

    this.subscriptions.push(
      this.form.valueChanges.subscribe(() => {
        if (!this._writing) this.emitIfChanged();
      }),
      this.form.statusChanges.subscribe(() => {
        if (!this._writing) this.emitIfChanged();
      }),
    );

    if (this._hasPendingValue) {
      const value = this._pendingValue;
      this._hasPendingValue = false;
      this._pendingValue = undefined;
      this.applyValue(value);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(one => one.unsubscribe());
  }

  protected abstract createEmptyModel(): T;

  protected getFormOptions(): AbstractControlOptions | null {
    return null;
  }

  protected afterFormInitialization(): void {
    this.resolveNgControl()?.control?.updateValueAndValidity({emitEvent: false});
  }

  protected refreshForm(model: T): void {
    this.bridge.patchFormFromModel(this.form, model);
  }

  protected formToModel(): T {
    return this.bridge.applyFormToModel(this.form, this.createEmptyModel());
  }

  isVisible(field: string): boolean {
    return this.form ? this.bridge.isVisibleByField(this.form, field) : true;
  }

  errorFor(field: string): string | null {
    const errors = this.form?.get(field)?.errors;
    if (!errors) {
      return null;
    }
    const code = Object.keys(errors)[0];
    return ERROR_KEYS[code] ?? null;
  }

  writeValue(value: T | null | undefined): void {
    if (!this.form) {
      this._pendingValue = value;
      this._hasPendingValue = true;
      return;
    }
    this.applyValue(value);
  }

  registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (!this.form) {
      return;
    }
    isDisabled ? this.form.disable({emitEvent: false}) : this.form.enable({emitEvent: false});
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    if (!this.form || this.form.valid) {
      return null;
    }
    return {
      invalidChildForm: true,
      details: this.validationIssues(),
    };
  }

  onSubmit(): void {
    if (!this.form) {
      return;
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this._baseline = cloneDeep(this.formToModel());
    this._hasBaseline = true;
    this.onTouched();
  }

  private applyValue(value: T | null | undefined): void {
    this._writing = true;
    try {
      this.refreshForm(value ?? this.createEmptyModel());
      this._baseline = cloneDeep(this.formToModel());
      this._hasBaseline = true;
      this.form.markAsPristine();
      this.form.markAsUntouched();
    } finally {
      this._writing = false;
    }
  }

  private emitIfChanged(): void {
    if (!this.form) {
      return;
    }

    const value = this.formToModel();
    if (!this._hasBaseline) {
      this._baseline = cloneDeep(value);
      this._hasBaseline = true;
      return;
    }

    const isSame = isEqual(value, this._baseline);
    this.onChange(value);
    if (isSame) {
      this.markParentPristine();
    }
  }

  private markParentPristine(): void {
    const control = this.resolveNgControl()?.control;
    if (control) {
      control.markAsPristine();
      control.markAsUntouched();
    }
  }

  private resolveNgControl(): NgControl | null {
    if (this._ngControl === undefined) {
      this._ngControl = this.injector.get(NgControl, null);
    }
    return this._ngControl;
  }

  private validationIssues(): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    for (const [field, control] of Object.entries(this.form.controls)) {
      const errors = control.errors;
      if (!errors) {
        continue;
      }
      for (const code of Object.keys(errors)) {
        issues.push({field, code});
      }
    }
    return issues;
  }
}
