import {CommonModule} from '@angular/common';
import {Component, EventEmitter, forwardRef, OnInit, Output} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule
} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {TranslateModule} from '@ngx-translate/core';

import {Proxy} from '../../../../domain/Proxy';
import {ProxyStorageService} from '../../../../services/proxy-storage.service';
import {SecretStorageService} from '../../../../services/secret-storage.service';
import {ModelFormController} from '../../../../utils/ModelFormController';
import {ChildFormAsFormControl} from '../../../EnhancedFormMixin';
import {MenuComponent} from '../../menu.component';
import {ProxyFormMixin} from './proxyFormMixin';

@Component({
  selector: 'app-proxy-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule
  ],
  templateUrl: './proxy-form.component.html',
  styleUrl: './proxy-form.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ProxyFormComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => ProxyFormComponent), multi: true }
  ]
})
export class ProxyFormComponent extends ChildFormAsFormControl(MenuComponent) implements OnInit {
  private _proxy!: Proxy;

  @Output() onProxySave = new EventEmitter<Proxy>();
  @Output() onProxyDelete = new EventEmitter<Proxy>();
  @Output() onProxyCancel = new EventEmitter<Proxy>();

  private modelFormController: ModelFormController<Proxy>;
  get proxy(): Proxy {
    return this._proxy;
  }

  // CVA overrides Instead of @Input
  override writeValue(value: Proxy): void {
    if (value) {
      this._proxy = value;
      super.writeValue(value);
    }
  }

  constructor(
    private fb: FormBuilder,
    private proxyStorage: ProxyStorageService,
    public secretStorage: SecretStorageService,
  ) {
    super();
    this.modelFormController = ProxyFormMixin.generateModelForm();
  }


  onInitForm(): FormGroup {
    return this.modelFormController.onInitForm(this.fb,
      {
        validators: [
          ProxyFormMixin.proxyNameShouldBeUnique(this.proxyStorage, () => this._proxy),
        ]
      });

  }

  onSaveOne() {
    if (this.form.valid) {
      this._proxy = this.formToModel();
      // Reset the dirty state
      this.onSubmit();
      this.onProxySave.emit(this.proxy);
    }
  }

  onDelete() {
    this.onProxyDelete.emit(this.proxy);
  }

  onCancel() {
    this.onProxyCancel.emit(this.proxy);
  }

  override refreshForm(value: any) {
    if (this.form) {
      this.modelFormController.refreshForm(this._proxy, this.form);
    }
  }


  override formToModel(): Proxy {
    if (!this._proxy) {
      this._proxy = new Proxy();
    }
    return this.modelFormController.formToModel(this._proxy, this.form);
  }
}
