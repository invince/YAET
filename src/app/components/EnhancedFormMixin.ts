import {Component, OnDestroy, OnInit} from '@angular/core';
import {AbstractControl, ControlValueAccessor, FormGroup, ValidationErrors, Validator} from '@angular/forms';
import {Subscription} from 'rxjs';

type Constructor<T = {}> = new (...args: any[]) => T;

export function ChildFormAsFormControl<TBase extends Constructor>(Base: TBase) {

  @Component({
    selector: 'app-child-form-as-formcontrol',
    imports: [],
    template: `<p>Abstract Menu</p>`
})
  abstract class ChildFormAsFormClazz extends Base implements OnInit, OnDestroy, ControlValueAccessor, Validator   {

    form!: FormGroup;

    private subscriptions: Subscription[] = [];

    abstract onInitForm(): FormGroup;

    abstract refreshForm(obj:any): void;
    abstract formToModel(): any;

    private _isWritingValue = false;
    private onValidatorChange: () => void = () => {};

    ngOnInit(): void {
      this.form = this.onInitForm();
      // Propagate changes to parent form
      this.subscriptions.push(this.form.valueChanges.subscribe(value => {
        if (!this._isWritingValue && this.form.dirty) this.onChange(value);
      }));
      this.subscriptions.push(this.form.statusChanges.subscribe(() => {
        this.onValidatorChange(); // notify parent of validity change
        if (!this._isWritingValue && this.form.dirty) this.onChange(this.form.value);
      }));
    }

    ngOnDestroy(): void {
      this.subscriptions.forEach(one => one.unsubscribe());
    }

    onSubmit() {
      // Reset the dirty state
      this.form.markAsPristine();
      this.form.markAsUntouched();
      // this.invalidStateChange.emit(false);
      // this.dirtyStateChange.emit(false);
    }


    private onChange: (value: any) => void = () => {};
    private onTouched: () => void = () => {};

    writeValue(value: any): void {
      if (value) {
        this._isWritingValue = true;
        this.refreshForm(value);
        this._isWritingValue = false;
      }
    }

    registerOnChange(fn: any): void {
      this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
      this.onTouched = fn;
    }

    registerOnValidatorChange(fn: () => void): void {
      this.onValidatorChange = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
      isDisabled ? this.form.disable() : this.form.enable();
    }

    // Add validation logic
    validate(control: AbstractControl): ValidationErrors | null {
      if (!this.form) {
        return null; // Not initialized yet, valid by default until ngOnInit
      }
      return this.form.valid ? null : { invalidChildForm: true };
    }

  }

  return ChildFormAsFormClazz;
}
