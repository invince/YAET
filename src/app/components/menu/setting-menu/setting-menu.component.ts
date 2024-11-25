import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MySettings} from '../../../domain/MySettings';
import {SettingService} from '../../../services/setting.service';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {LocalTerminalType} from '../../../domain/LocalTerminalProfile';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatInput} from '@angular/material/input';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {MasterKeyComponent} from '../master-key/master-key.component';
import {ConfirmationComponent} from '../confirmation/confirmation.component';
import {SecretService} from '../../../services/secret.service';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-setting-menu',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatIcon,
    MatIconButton,
    MatTabGroup,
    MatTab,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    KeyValuePipe,
    MatInput,
    MatButton,
    MatSuffix,
  ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent implements OnInit, OnDestroy {


  settings!: MySettings;

  LOCAL_TERM_OPTIONS = LocalTerminalType;

  ui_showLocalTerminalCustom = false;
  private subscription!: Subscription;

  constructor(
    private settingService: SettingService,
    public secretService: SecretService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
  ) {
    super();
    this.init();

  }
  private init() {
    this.settings = this.clone(this.settingService.settings);
    if (this.settings.localTerminalSetting && this.settings.localTerminalSetting.type === LocalTerminalType.CUSTOM) {
      this.ui_showLocalTerminalCustom = true;
    }

  }

  openDeleteMasterKeyConfirmationDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: 'Delete master key, if you continue, all existing secrets will be invalid. Do you want continue ?' },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.secretService.deleteMasterKey();
        this._snackBar.open('Master Key Deleted', 'OK', {
          duration: 3000
        });
      }
    });
  }

  ngOnInit() {
    this.subscription =  this.settingService.settingLoadedEvent.subscribe(() => {
      this.init();
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    })
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Clean up the subscription
  }


  clone(setting: MySettings): MySettings {
    return JSON.parse(JSON.stringify(setting));
  }


  override onSave() {
    this.settingService.save(this.settings);
  }



  onSelectLocalTerminalType($event: LocalTerminalType) {
    this.settings.localTerminalSetting.type = $event;
    this.ui_showLocalTerminalCustom = this.settings.localTerminalSetting.type === LocalTerminalType.CUSTOM;
    this.settingService.validateLocalTerminalSettings(this.settings.localTerminalSetting);
  }

  reload() {
    this.settingService.reload();
  }


  openMasterKeyModal() {
    const dialogRef = this.dialog.open(MasterKeyComponent, {
      width: '260px',
      data: {}
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
    });
  }
}
