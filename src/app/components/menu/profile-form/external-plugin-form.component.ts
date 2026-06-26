import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';

@Component({
  selector: 'app-external-plugin-form',
  template: `
    <div #formContainer></div>
  `,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: ExternalPluginFormComponent,
    multi: true,
  }],
})
export class ExternalPluginFormComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() pluginFormElement = '';
  @Input() profileType = '';
  @ViewChild('formContainer', {static: true}) formContainer!: ElementRef;

  private _el: HTMLElement | null = null;
  private _onChange: any = () => {};
  private _onTouched: any = () => {};

  ngOnInit(): void {
    if (!this.pluginFormElement) return;
    const el = document.createElement(this.pluginFormElement);
    el.setAttribute('data-profile-type', this.profileType);
    el.addEventListener('change', () => this._onChange(this._getValue(el)));
    this.formContainer.nativeElement.appendChild(el);
    this._el = el;
  }

  writeValue(obj: any): void {
    if (this._el && typeof (this._el as any).setForm === 'function') {
      (this._el as any).setForm(obj);
    }
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this._el) {
      (this._el as any).disabled = isDisabled;
    }
  }

  private _getValue(el: HTMLElement): any {
    return typeof (el as any).getForm === 'function' ? (el as any).getForm() : {};
  }

  ngOnDestroy(): void {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
  }
}
