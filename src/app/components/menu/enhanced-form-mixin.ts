
import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {FormGroup} from '@angular/forms';
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
  abstract class IsAChildFormClazz extends Base implements OnInit, OnDestroy {
    // @ts-ignore

    form!: FormGroup;
    @Output() dirtyStateChange = new EventEmitter<boolean>();
    private lastDirtyState = false;
    // @ts-ignore
    @Output() invalidStateChange = new EventEmitter<boolean>();
    private lastInvalidState = false;

    private subscriptions: Subscription[] = [];

    abstract onInitForm(): FormGroup;

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
