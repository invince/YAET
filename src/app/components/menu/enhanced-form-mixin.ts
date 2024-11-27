
import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {ControlValueAccessor, FormGroup} from '@angular/forms';
import {Subscription} from 'rxjs';

type Constructor<T = {}> = new (...args: any[]) => T;

export function HasChildForm<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private _lastChildFormDirtyState = false;
    private _lastChildFormInvalidState = false;

    get lastChildFormDirtyState(): boolean {
      return this._lastChildFormDirtyState;
    }

    get lastChildFormInvalidState(): boolean {
      return this._lastChildFormInvalidState;
    }

    public onChildFormInvalidStateChange($event: any) {
      this._lastChildFormInvalidState = $event;
    }

    public onChildFormDirtyStateChange($event: any) {
      this._lastChildFormDirtyState = $event;
    }

  };
}


export function IsAChildForm<TBase extends Constructor>(Base: TBase) {

  @Component({
    selector: 'app-is-a-child-form',
    standalone: true,
    imports: [],
    template: `<p>Abstract Menu</p>`,
  })
  abstract class IsAChildFormClazz extends Base implements OnInit, OnDestroy  {
    // @ts-ignore

    form!: FormGroup;
    @Output() dirtyStateChange = new EventEmitter<boolean>();
    private lastDirtyState = false;
    // @ts-ignore
    @Output() invalidStateChange = new EventEmitter<boolean>();
    private lastInvalidState = false;

    private subscriptions: Subscription[] = [];

    abstract onInitForm(): FormGroup;

    abstract refreshForm(obj:any): void;
    abstract formToModel(): void;

    ngOnInit(): void {
      this.form = this.onInitForm();
      const subscription = this.form.valueChanges.subscribe(() => {
        const isDirty = this.form.dirty;
        if (isDirty !== this.lastDirtyState) {
          this.lastDirtyState = isDirty;
          this.dirtyStateChange.emit(isDirty);
        }

        const invalid = this.form.invalid;
        if (invalid !== this.lastInvalidState) {
          this.lastInvalidState = invalid;
          this.invalidStateChange.emit(invalid);
        }
      });
      this.subscriptions.push(subscription);
    }

    ngOnDestroy(): void {
      this.subscriptions.forEach(one => one.unsubscribe());
    }

    onSubmit() {
      // Reset the dirty state
      this.form.markAsPristine();
      this.form.markAsUntouched();
      this.invalidStateChange.emit(false);
      this.dirtyStateChange.emit(false);
    }

  }

  return IsAChildFormClazz;
}


export function ChildFormAsFormControl<TBase extends Constructor>(Base: TBase) {

  @Component({
    selector: 'app-child-form-as-formcontrol',
    standalone: true,
    imports: [],
    template: `<p>Abstract Menu</p>`,
  })
  abstract class ChildFormAsFormClazz extends Base implements OnInit, OnDestroy, ControlValueAccessor  {

    form!: FormGroup;

    private subscriptions: Subscription[] = [];

    abstract onInitForm(): FormGroup;

    abstract refreshForm(obj:any): void;
    abstract formToModel(): any;

    ngOnInit(): void {
      this.form = this.onInitForm();
      // Propagate changes to parent form
      this.subscriptions.push(this.form.valueChanges.subscribe(value => this.onChange(value)));
      this.subscriptions.push(this.form.statusChanges.subscribe(() => this.onChange(this.form.value)));
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
        this.refreshForm(value);
      }
    }

    registerOnChange(fn: any): void {
      this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
      this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
      isDisabled ? this.form.disable() : this.form.enable();
    }

  }

  return ChildFormAsFormClazz;
}
