import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Proxy } from '../../../../domain/Proxy';
import { Secret } from '../../../../domain/Secret';
import { ProxyStorageService } from '../../../../services/proxy-storage.service';
import { SecretStorageService } from '../../../../services/secret-storage.service';
import {IsAChildForm} from '../../../EnhancedFormMixin';
import {MenuComponent} from '../../menu.component';
import {ProxyFormMixin} from './proxyFormMixin';
import {ModelFormController} from '../../../../utils/ModelFormController';

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
        MatIconModule
    ],
    templateUrl: './proxy-form.component.html',
    styleUrl: './proxy-form.component.scss'
})
export class ProxyFormComponent extends IsAChildForm(MenuComponent) implements OnInit {
    private _proxy!: Proxy;

    @Output() onProxySave = new EventEmitter<Proxy>();
    @Output() onProxyDelete = new EventEmitter<Proxy>();
    @Output() onProxyCancel = new EventEmitter<Proxy>();

    private modelFormController : ModelFormController<Proxy>;
    get proxy(): Proxy {
        return this._proxy;
    }

    @Input() // input on setter, so we can combine trigger, it's easier than ngOnChange
    set proxy(value: Proxy) {
        this._proxy = value;
        this.refreshForm(value);
    }

    override afterFormInitialization() { // we cannot relay only on setter, because 1st set it before ngOnInit
      this.refreshForm(this._proxy);
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
            ProxyFormMixin.proxyNameShouldBeUnique(this.proxyStorage, this._proxy),
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
