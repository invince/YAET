import {
  AfterViewInit,
  Component,
  EventEmitter,
  inject,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  NgControl,
  ValidationErrors,
  Validator
} from '@angular/forms';

/**
 * Host component that dynamically renders a plugin form component
 * and bridges ControlValueAccessor between the parent form and the inner component.
 *
 * Usage:
 *   <app-plugin-form-host [componentType]="VncProfileFormComponent" formControlName="vncProfileForm">
 */
@Component({
  selector: 'app-plugin-form-host',
  template: `<ng-container #host></ng-container>`,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: PluginFormHostComponent,
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: PluginFormHostComponent,
      multi: true,
    },
  ],
})
export class PluginFormHostComponent implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor, Validator {
  @Input() componentType!: Type<any>;
  @ViewChild('host', { read: ViewContainerRef }) host!: ViewContainerRef;

  @Output() dirtyStateChange = new EventEmitter<boolean>();

  private innerComponent: any;
  private pendingValue: any;
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};
  private _originalWrittenValue: any = undefined;
  private _injector = inject(Injector);

  private get _parentNgControl(): NgControl | null {
    return this._injector.get(NgControl, null);
  }

  ngAfterViewInit() {
    if (this.componentType && this.host) {
      this.createComponent();
    } else if (this.pendingValue !== undefined) {
      this.createComponent();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['componentType'] && !changes['componentType'].firstChange && this.host) {
      this.host.clear();
      this.innerComponent = null;
      this.createComponent();
    }
  }

  private createComponent() {
    const type = this.componentType;
    if (!type || !this.host) return;

    const ref = this.host.createComponent(type);

    ref.changeDetectorRef.detectChanges();
    this.innerComponent = ref.instance;

    if (this.innerComponent.registerOnChange) {
      this.innerComponent.registerOnChange((value: any) => {
        const isSame = JSON.stringify(value) === JSON.stringify(this._originalWrittenValue);
        if (!isSame) {
          this.onChange(value);
        } else if (this._parentNgControl?.control) {
          this._parentNgControl.control.markAsPristine();
          this._parentNgControl.control.markAsUntouched();
        }
      });
    }

    if (this.innerComponent.registerOnTouched) {
      this.innerComponent.registerOnTouched(() => {
        this.onTouched();
      });
    }

    if (this.innerComponent.dirtyStateChange) {
      this.innerComponent.dirtyStateChange.subscribe((dirty: boolean) => {
        this.dirtyStateChange.emit(dirty);
      });
    }

    if (this.pendingValue !== undefined) {
      this.innerComponent.writeValue(this.pendingValue);
      this._originalWrittenValue = JSON.parse(JSON.stringify(this.pendingValue));
      this.pendingValue = undefined;
    }
  }

  writeValue(value: any): void {
    this._originalWrittenValue = JSON.parse(JSON.stringify(value));
    if (this.innerComponent) {
      this.innerComponent.writeValue(value);
    } else {
      this.pendingValue = value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (this.innerComponent && this.innerComponent.setDisabledState) {
      this.innerComponent.setDisabledState(isDisabled);
    }
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (this.innerComponent && this.innerComponent.validate) {
      return this.innerComponent.validate(control);
    }
    return null;
  }

  ngOnDestroy() {
    if (this.host) {
      this.host.clear();
    }
  }
}
