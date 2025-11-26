import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { MasterKeyComponent } from '../../components/dialog/master-key/master-key.component';
import { MenuConsts } from '../../domain/MenuConsts';
import { ProfileCategory, ProfileType } from '../../domain/profile/Profile';
import { TabInstance } from '../../domain/TabInstance';
import { LogService } from '../../services/log.service';
import { MasterKeyService } from '../../services/master-key.service';
import { ModalControllerService } from '../../services/modal-controller.service';
import { NotificationService } from '../../services/notification.service';
import { SessionService } from '../../services/session.service';
import { SettingService } from '../../services/setting.service';
import { TabService } from '../../services/tab.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatIcon,
    ],
    templateUrl: './sidebar.component.html',
    styleUrl: './sidebar.component.css'
})
export class SidebarComponent {

    MENU_ADD: string = MenuConsts.MENU_ADD;
    MENU_PROFILE: string = MenuConsts.MENU_PROFILE;
    MENU_SECURE: string = MenuConsts.MENU_SECURE;
    MENU_CLOUD: string = MenuConsts.MENU_CLOUD;
    MENU_SETTING: string = MenuConsts.MENU_SETTING;

    subscriptions: Subscription[] = [];

    constructor(
        private log: LogService,
        private settingService: SettingService,
        private sessionService: SessionService,
        private masterKeyService: MasterKeyService,
        public tabService: TabService,
        public modalControl: ModalControllerService,
        private notification: NotificationService,
        public dialog: MatDialog,
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
        const dialogRef = this.dialog.open(MasterKeyComponent, {
            width: '260px',
            data: {}
        });

        this.subscriptions.push(dialogRef.afterClosed().subscribe(result => {
            this.log.debug('Master key modal closed');
        }));
    }

    profileMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_PROFILE));
    }

    cloudMenu() {
        this.requireMasterKey(() => this.toggleMenu(this.MENU_CLOUD));
    }

    settingMenu() {
        this.toggleMenu(this.MENU_SETTING);
    }

    toggleMenu(menu: string) {
        this.modalControl.toggleMenu(menu);
    }

    toggleSplit() {
        this.tabService.toggleSplit();
    }
}
