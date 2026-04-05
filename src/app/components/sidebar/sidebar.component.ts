import {CommonModule} from '@angular/common';
import {Component, OnDestroy} from '@angular/core';
import {ButtonModule} from 'primeng/button';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Subscription} from 'rxjs';
import {MasterKeyComponent} from '../../components/dialog/master-key/master-key.component';
import {MenuConsts} from '../../domain/MenuConsts';
import {ProfileCategory, ProfileType} from '../../domain/profile/Profile';
import {TabInstance} from '../../domain/TabInstance';
import {LogService} from '../../services/log.service';
import {MasterKeyService} from '../../services/master-key.service';
import {ModalControllerService} from '../../services/modal-controller.service';
import {NotificationService} from '../../services/notification.service';
import {SessionService} from '../../services/session.service';
import {SettingService} from '../../services/setting.service';
import {TabService} from '../../services/tab.service';

@Component({
    selector: 'app-sidebar',
    imports: [
        CommonModule,
        ButtonModule,
    ],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnDestroy {

    MENU_ADD: string = MenuConsts.MENU_ADD;
    MENU_PROFILE: string = MenuConsts.MENU_PROFILE;
    MENU_SECURE: string = MenuConsts.MENU_SECURE;
    MENU_CLOUD: string = MenuConsts.MENU_CLOUD;
    MENU_PROXY: string = MenuConsts.MENU_PROXY;
    MENU_SETTING: string = MenuConsts.MENU_SETTING;

    subscriptions: Subscription[] = [];
    private dialogRef: DynamicDialogRef | null = null;

    constructor(
        private log: LogService,
        private settingService: SettingService,
        private sessionService: SessionService,
        private masterKeyService: MasterKeyService,
        public tabService: TabService,
        public modalControl: ModalControllerService,
        private notification: NotificationService,
        public dialogService: DialogService,
    ) { }

    ngOnDestroy() {
        this.subscriptions.forEach(one => one.unsubscribe());
    }

    addLocalTerminal() {
        this.modalControl.closeModal();
        const tab = new TabInstance(ProfileCategory.TERMINAL,
            this.sessionService.create(this.settingService.createLocalTerminalProfile(), ProfileType.LOCAL_TERMINAL));
        this.tabService.addTab(tab);
    }

    addMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_ADD));
    }

    secureMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_SECURE));
    }

    profileMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_PROFILE));
    }

    cloudMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_CLOUD));
    }

    proxyMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_PROXY));
    }

    settingMenu() {
        this.toggleMenu(this.MENU_SETTING);
    }

    requireMasterKey(callback: () => void) {
        if (this.masterKeyService.hasMasterKey) {
            callback();
        } else {
            this.notification.info('Please define Master key in Settings first', 'Set it', () => {
                this.openMasterKeyModal();
            });
        }
    }

    openMasterKeyModal() {
        this.dialogRef = this.dialogService.open(MasterKeyComponent, {
            header: 'Master Key',
            width: '260px',
            data: {}
        });

        if (this.dialogRef) {
            this.subscriptions.push(this.dialogRef.onClose.subscribe(result => {
                this.log.debug('Master key modal closed');
            }));
        }
    }

    toggleMenu(menu: string) {
        this.modalControl.toggleMenu(menu);
    }
}
