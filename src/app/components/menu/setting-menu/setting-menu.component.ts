import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MySettings} from '../../../domain/setting/MySettings';
import {SettingService} from '../../../services/setting.service';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {LocalTerminalProfile, LocalTerminalType} from '../../../domain/profile/LocalTerminalProfile';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatInput} from '@angular/material/input';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {MasterKeyComponent} from './master-key/master-key.component';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SideNavType, UISettings} from '../../../domain/setting/UISettings';
import {TagsFormComponent} from './tags-form/tags-form.component';
import {GroupsFormComponent} from './groups-form/groups-form.component';
import {GeneralSettings} from '../../../domain/setting/GeneralSettings';
import {NgxSpinnerService} from 'ngx-spinner';
import {MatCheckbox} from '@angular/material/checkbox';
import packageJson from '../../../../../package.json';
import {RemoteDesktopSettings} from '../../../domain/setting/RemoteDesktopSettings';
import {TerminalSettings} from '../../../domain/setting/TerminalSettings';
import {FileExplorerSettings} from '../../../domain/setting/FileExplorerSettings';
import {MatAccordion, MatExpansionModule} from '@angular/material/expansion';

@Component({
  selector: 'app-setting-menu',
  standalone: true,
  imports: [
    TagsFormComponent,
    GroupsFormComponent,

    FormsModule,
    ReactiveFormsModule,
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
    MatCheckbox,
    MatExpansionModule
  ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  generalForm!: FormGroup;
  uiForm!: FormGroup;
  terminalForm!: FormGroup;
  remoteDesktopForm!: FormGroup;
  fileExplorerForm!: FormGroup;

  LOCAL_TERM_OPTIONS = LocalTerminalType;

  SIDE_NAV_TYPE_OPTIONS = SideNavType;

  settingsCopy!: MySettings;
  private subscription!: Subscription;
  currentTabIndex: number = 0;

  GENERAL_FORM_TAB_INDEX = 0;
  UI_FORM_TAB_INDEX = 1;
  GROUP_TAG_FORM_TAB_INDEX = 2;
  TERM_FORM_TAB_INDEX = 3;
  REMOTE_DESKTOP_FORM_TAB_INDEX = 4;
  FILE_EXPLORER_FORM_TAB_INDEX = 5;

  version ='';

  constructor(
    private fb: FormBuilder,
    private settingService: SettingService,
    private settingStorage: SettingStorageService,
    public masterKeyService: MasterKeyService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
    private spinner: NgxSpinnerService
  ) {
    super();
    this.version = packageJson.version;
  }


  openDeleteMasterKeyConfirmationDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: 'Delete master key, if you continue, all existing secrets will be invalid. Do you want continue ?' },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.masterKeyService.deleteMasterKey();
        this._snackBar.open('Master Key Deleted', 'OK', {
          duration: 3000
        });
      }
    });
  }

  ngOnInit() {
    if (!this.settingService.isLoaded ) {
      this._snackBar.open('Settings not loaded, we\'ll reload it, please close setting menu and reopen', 'OK', {
        duration: 3000
      });
      this.settingService.reload();
    }

    this.settingsCopy = this.settingStorage.settings;

    this.generalForm = this.initGeneralForm();
    this.uiForm = this.initUiForm();
    this.terminalForm = this.initTerminalForm();
    this.remoteDesktopForm = this.initRemoteDesktopForm();
    this.fileExplorerForm = this.initFileExplorerForm();

    this.refreshForm(this.settingsCopy);

    this.subscription =  this.settingService.settingLoadedEvent.subscribe(() => {
      this.settingsCopy = this.settingStorage.settings;
      this.refreshForm(this.settingsCopy);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    })



  }

  private initGeneralForm() {
    return this.fb.group(
      {
        autoUpdate:     [''],
      },
      {validators: []}
    );
  }

  private initFileExplorerForm() {
    return this.fb.group({

    });
  }

  private initRemoteDesktopForm() {
    return this.fb.group(
      {
        vncClipboardCompatibleMode:     [''],
      },
      {validators: []}
    );
  }

  private initUiForm() {
    return this.fb.group(
      {
        uiProfileLabelLength:     ['', Validators.required],
        profileSideNavType:       ['', Validators.required],
        uiSecretLabelLength:      ['', Validators.required],
        uiSecretLabelLengthInDropDown:      ['', Validators.required],
      },
      {validators: []}
    );
  }
  private initTerminalForm() {
    return this.fb.group(
      {
        localTerminalType:        ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        localTerminalExecPath:    ['', Validators.required],
        defaultOpen:              [''],
      },
      {validators: []}
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Clean up the subscription
  }



  override async onSave() {
    if (this.currentTabIndex == this.GENERAL_FORM_TAB_INDEX) {
      this.settingsCopy.general = this.generalFormToModel();
      await this.commitChange();
    }
    if (this.currentTabIndex == this.UI_FORM_TAB_INDEX && this.uiForm.valid) {
      this.settingsCopy.ui = this.uiFormToModel();
      await this.commitChange();
    }
    if (this.currentTabIndex == this.TERM_FORM_TAB_INDEX && this.terminalForm.valid) {
      this.settingsCopy.terminal = this.termFormToModel();
      await this.commitChange();
    }
    if (this.currentTabIndex == this.REMOTE_DESKTOP_FORM_TAB_INDEX && this.remoteDesktopForm.valid) {
      this.settingsCopy.remoteDesk = this.remoteDesktopFormToModel();
      await this.commitChange();
    }

    if (this.currentTabIndex == this.FILE_EXPLORER_FORM_TAB_INDEX && this.fileExplorerForm.valid) {
      this.settingsCopy.fileExplorer = this.fileExplorerFormToModel();
      await this.commitChange();
    }
  }

  currentFormValid(): boolean {
    if (this.currentTabIndex == this.GENERAL_FORM_TAB_INDEX) {
      return true;
    }
    if (this.currentTabIndex == this.UI_FORM_TAB_INDEX) {
      return this.uiForm.valid;
    }
    if (this.currentTabIndex == this.TERM_FORM_TAB_INDEX) {
      return this.terminalForm.valid;
    }
    if (this.currentTabIndex == this.REMOTE_DESKTOP_FORM_TAB_INDEX) {
      return this.remoteDesktopForm.valid;
    }
    return false;
  }


  onSelectLocalTerminalType($event: any) {
    let terminalSettings = new TerminalSettings();
    terminalSettings.localTerminal.type = $event.value;
    this.settingService.validateTerminalSettings(terminalSettings);
    this.terminalForm.get('localTerminalExecPath')?.setValue(terminalSettings.localTerminal.execPath);
  }

  reload() {
    this.spinner.show();
    this.settingService.reload();
    this.spinner.hide();
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


  refreshForm(value: any) {
    if (!value) {
      value = new MySettings();
    }

    if(this.generalForm) {
      this.generalForm.reset();
      if (!value.general) {
        value.general = new GeneralSettings();
      }
      this.generalForm.get('autoUpdate')?.setValue(value.general.autoUpdate);
    }

    if (this.uiForm) {
      this.uiForm.reset();
      if (!value.ui) {
        value.ui = new UISettings();
      }
      this.uiForm.get('uiProfileLabelLength')?.setValue(value.ui.profileLabelLength);
      this.uiForm.get('uiSecretLabelLength')?.setValue(value.ui.secretLabelLength);
      this.uiForm.get('uiSecretLabelLengthInDropDown')?.setValue(value.ui.secretLabelLengthInDropDown);
      this.uiForm.get('profileSideNavType')?.setValue(value.ui.profileSideNavType);
    }


    if(this.remoteDesktopForm) {
      this.remoteDesktopForm.reset();
      if (!value.remoteDesktop) {
        value.remoteDesktop = new RemoteDesktopSettings();
      }
      this.remoteDesktopForm.get('vncClipboardCompatibleMode')?.setValue(value.remoteDesktop.vncClipboardCompatibleMode);
    }

    if (this.terminalForm) {
      this.terminalForm.reset();
      if (!value.terminal) {
        value.terminal = new TerminalSettings();
      }
      if (!value.terminal.localTerminal) {
        value.terminal.localTerminal = new LocalTerminalProfile();
      }
      this.terminalForm.get('localTerminalType')?.setValue(value.terminal.localTerminal.type);
      this.terminalForm.get('localTerminalExecPath')?.setValue(value.terminal.localTerminal.execPath);
      this.terminalForm.get('defaultOpen')?.setValue(value.terminal.localTerminal.defaultOpen);
    }
  }

  shouldDisableSave() {
    return [this.GROUP_TAG_FORM_TAB_INDEX].includes(this.currentTabIndex);
  }


  private uiFormToModel() {
    let ui = new UISettings();
    if (!ui) {
      ui = new UISettings();
    }
    ui.profileLabelLength = this.uiForm.get('uiProfileLabelLength')?.value;
    ui.profileSideNavType = this.uiForm.get('profileSideNavType')?.value;
    ui.secretLabelLength = this.uiForm.get('uiSecretLabelLength')?.value;
    ui.secretLabelLengthInDropDown = this.uiForm.get('uiSecretLabelLengthInDropDown')?.value;

    return ui;
  }

  private generalFormToModel() {
    let general = new GeneralSettings();
    general.autoUpdate = this.generalForm.get('autoUpdate')?.value;

    return general;
  }

  private remoteDesktopFormToModel() {
    let vnc = new RemoteDesktopSettings();
    vnc.vncClipboardCompatibleMode = this.remoteDesktopForm.get('vncClipboardCompatibleMode')?.value;

    return vnc;
  }

  private termFormToModel() {
    let terminal = new TerminalSettings();
    terminal.localTerminal.type = this.terminalForm.get('localTerminalType')?.value;
    terminal.localTerminal.execPath = this.terminalForm.get('localTerminalExecPath')?.value;
    terminal.localTerminal.defaultOpen = this.terminalForm.get('defaultOpen')?.value;
    return terminal;
  }

  private fileExplorerFormToModel() {
    let fileExplorer = new FileExplorerSettings();
    return fileExplorer;
  }

  async commitChange() {
    await this.settingService.save(this.settingsCopy);
  }


}
