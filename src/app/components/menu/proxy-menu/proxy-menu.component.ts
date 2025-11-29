import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { Subscription } from 'rxjs';

import { MenuConsts } from '../../../domain/MenuConsts';
import { Proxies, Proxy } from '../../../domain/Proxy';
import { FilterKeywordPipe } from '../../../pipes/filter-keyword.pipe';
import { ModalControllerService } from '../../../services/modal-controller.service';
import { NotificationService } from '../../../services/notification.service';
import { ProxyStorageService } from '../../../services/proxy-storage.service';
import { ProxyService } from '../../../services/proxy.service';
import { ConfirmationComponent } from '../../confirmation/confirmation.component';
import { HasChildForm } from '../../EnhancedFormMixin';
import { MenuComponent } from '../menu.component';
import { ProxyFormComponent } from './proxy-form/proxy-form.component';

@Component({
    selector: 'app-proxy-menu',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatButtonModule,
        MatSidenavModule,
        MatSelectModule,
        MatInput,
        MatIcon,
        FilterKeywordPipe,
        ProxyFormComponent
    ],
    templateUrl: './proxy-menu.component.html',
    styleUrl: './proxy-menu.component.scss',
    providers: [FilterKeywordPipe]
})
export class ProxyMenuComponent extends HasChildForm(MenuComponent) implements OnInit, OnDestroy {

    selectedId!: string | undefined;
    selectedProxy!: Proxy | undefined;
    subscriptions: Subscription[] = [];
    filter!: string;

    proxiesCopy!: Proxies;

    keywordsProviders: ((proxy: Proxy) => string | string[])[] = [
        (proxy: Proxy) => proxy.name,
        (proxy: Proxy) => proxy.type,
        (proxy: Proxy) => proxy.host,
    ];

    constructor(
        public proxyService: ProxyService,
        public proxyStorageService: ProxyStorageService,
        private notification: NotificationService,
        private dialog: MatDialog,
        private modalControl: ModalControllerService,
    ) {
        super();
    }

    ngOnDestroy(): void {
        if (this.subscriptions) {
            this.subscriptions.forEach(one => one.unsubscribe());
        }
    }

    ngOnInit(): void {
        this.subscriptions.push(this.modalControl.modalCloseEvent.subscribe(one => {
            if (one && one.includes(MenuConsts.MENU_PROXY)) {
                this.modalControl.closeModal();
            }
        }));

        if (!this.proxyService.isLoaded) {
            this.notification.info('Proxies not loaded, reloading...');
            this.proxyService.reload();
        }

        this.proxiesCopy = this.proxyStorageService.dataCopy;
        // Sort by name
        this.proxiesCopy.proxies = this.proxiesCopy.proxies.sort((a, b) => a.name.localeCompare(b.name));
    }

    addTab() {
        let proxy = new Proxy();
        this.proxiesCopy.proxies.push(proxy);
        this.selectedId = proxy.id;
        this.selectedProxy = proxy;
    }

    onTabChange(proxy: Proxy) {
        if (!proxy) return;

        if (this.selectedId == proxy.id) {
            this.selectedProxy = proxy;
            return;
        }
        if (this.selectedId && (this.lastChildFormInvalidState || this.lastChildFormDirtyState)) {
            this.notification.info('Please finish current form');
            return;
        }
        this.selectedId = proxy.id;
        this.selectedProxy = proxy;
    }

    async onDelete($event: Proxy) {
        const dialogRef = this.dialog.open(ConfirmationComponent, {
            width: '300px',
            data: { message: 'Do you want to delete this proxy: ' + $event.name + '?' },
        });

        this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
            if (result) {
                this.proxyService.deleteOne($event);
                await this.commitChange();
                this.selectedId = undefined;
                this.selectedProxy = undefined;
            }
        }));
    }

    async onSaveOne($event: Proxy) {
        this.proxyService.updateOne($event);
        await this.commitChange();
    }

    onCancel($event: Proxy) {
        this.close();
    }

    proxyTabLabel(proxy: Proxy) {
        let label = 'New';
        if (proxy && proxy.name) {
            label = proxy.name;
        }
        if (proxy.id == this.selectedId && this.lastChildFormDirtyState) {
            label += '*'
        }
        return label;
    }

    hasNewProxy() {
        return this.selectedProxy?.isNew;
    }

    async commitChange() {
        await this.proxyService.saveAll(this.proxiesCopy);
    }
}
