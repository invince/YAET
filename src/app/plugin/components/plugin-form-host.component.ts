import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  Type,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
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
export class PluginFormHostComponent implements AfterViewInit, OnDestroy, ControlValueAccessor, Validator {
  @Input() componentType!: Type<any>;
  @ViewChild('host', { read: ViewContainerRef }) host!: ViewContainerRef;

  @Output() dirtyStateChange = new EventEmitter<boolean>();

  private innerComponent: any;
  private pendingValue: any;
  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit() {
    if (this.componentType && this.host) {
      const ref = this.host.createComponent(this.componentType);

      // Force change detection so ngOnInit() runs and this.form is created
      ref.changeDetectorRef.detectChanges();

      this.innerComponent = ref.instance;

      // Bridge ControlValueAccessor: inner component calls onChange → forward to parent
      if (this.innerComponent.registerOnChange) {
        this.innerComponent.registerOnChange((value: any) => {
          this.onChange(value);
        });
      }

      // Bridge touched
      if (this.innerComponent.registerOnTouched) {
        this.innerComponent.registerOnTouched(() => {
          this.onTouched();
        });
      }

      // Bridge dirtyStateChange
      if (this.innerComponent.dirtyStateChange) {
        this.innerComponent.dirtyStateChange.subscribe((dirty: boolean) => {
          this.dirtyStateChange.emit(dirty);
        });
      }

      // Apply pending value if writeValue was called before component creation
      if (this.pendingValue !== undefined) {
        this.innerComponent.writeValue(this.pendingValue);
        this.pendingValue = undefined;
      }
    }
  }

  writeValue(value: any): void {
    if (this.innerComponent) {
      this.innerComponent.writeValue(value);
    } else {
      // Cache value until component is created
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
