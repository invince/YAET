import {Component, DestroyRef, inject, OnInit} from '@angular/core';
import {AbstractControl, ControlValueAccessor, FormGroup, ValidationErrors, Validator} from '@angular/forms';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

type Constructor<T = {}> = new (...args: any[]) => T;

export function ChildFormAsFormControl<TBase extends Constructor>(Base: TBase) {

  @Component({
    selector: 'app-child-form-as-formcontrol',
    imports: [],
    template: `<p>Abstract Menu</p>`
})
  abstract class ChildFormAsFormClazz extends Base implements OnInit, ControlValueAccessor, Validator   {

    form!: FormGroup;

    protected destroyRef = inject(DestroyRef);

    abstract onInitForm(): FormGroup;

    abstract refreshForm(obj:any): void;
    abstract formToModel(): any;

    private onValidatorChange: () => void = () => {};

    ngOnInit(): void {
      this.form = this.onInitForm();
      // Propagate changes to parent form
      this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(value => {
        if (this.form.dirty) this.onChange(value);
      });
      this.form.statusChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.onValidatorChange(); // notify parent of validity change
        if (this.form.dirty) this.onChange(this.form.value);
      });
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
        this.refreshForm(value);
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
        return { invalidChildForm: true, reason: 'uninitialized' };
      }
      return this.form.valid ? null : { invalidChildForm: true, errors: this.form.errors };
    }

  }

  return ChildFormAsFormClazz;
}
