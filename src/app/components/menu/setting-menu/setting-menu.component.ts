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
import {MatExpansionModule} from '@angular/material/expansion';
import {LogService} from '../../../services/log.service';
import {NotificationService} from '../../../services/notification.service';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../utils/ModelFormController';
import {SecretType} from '../../../domain/Secret';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SecretService} from '../../../services/secret.service';

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
    MatExpansionModule,
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
  private subscriptions: Subscription[] =[];
  currentTabIndex: number = 0;

  GENERAL_FORM_TAB_INDEX = 0;
  UI_FORM_TAB_INDEX = 1;
  GROUP_TAG_FORM_TAB_INDEX = 2;
  TERM_FORM_TAB_INDEX = 3;
  REMOTE_DESKTOP_FORM_TAB_INDEX = 4;
  FILE_EXPLORER_FORM_TAB_INDEX = 5;

  version ='';

  private mfcGeneral                  : ModelFormController<GeneralSettings>;
  private mfcUI                       : ModelFormController<UISettings>;
  private mfcRemoteDesktop            : ModelFormController<RemoteDesktopSettings>;
  private mfcLocalTerminal             : ModelFormController<LocalTerminalProfile>;
  private mfcFileExplorer             : ModelFormController<FileExplorerSettings>;

  constructor(
    private log: LogService,
    private fb: FormBuilder,
    private settingService: SettingService,
    private settingStorage: SettingStorageService,
    private secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public masterKeyService: MasterKeyService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private notification: NotificationService,
    private spinner: NgxSpinnerService
  ) {
    super();
    this.version = packageJson.version;


    this.mfcGeneral = new ModelFormController<GeneralSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['autoUpdate', 'autoUpdate'],
      ])
    );

    this.mfcUI = new ModelFormController<UISettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['profileLabelLength',          { name: 'uiProfileLabelLength', formControlOption:  ['', Validators.required]}],
        ['profileSideNavType',          { name: 'profileSideNavType', formControlOption:  ['', Validators.required]}],
        ['secretLabelLength',           { name: 'uiSecretLabelLength', formControlOption:  ['', Validators.required]}],
        ['secretLabelLengthInDropDown', { name: 'uiSecretLabelLengthInDropDown', formControlOption:  ['', Validators.required]}],
      ])
    );

    this.mfcRemoteDesktop = new ModelFormController<RemoteDesktopSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['vncClipboardCompatibleMode',     'vncClipboardCompatibleMode'],
        ['vncCompressionLevel',            { name: 'vncCompressionLevel', formControlOption:  ['', [Validators.required, Validators.min(0), Validators.max(9)]]}],
        ['vncQuality',                     { name: 'vncQuality', formControlOption:  ['', [Validators.required,  Validators.min(1), Validators.max(9)]]}],
      ])
    );


    this.mfcLocalTerminal = new ModelFormController<LocalTerminalProfile>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['type',         { name: 'localTerminalType', formControlOption:  ['', Validators.required]}],
        ['execPath',     { name: 'localTerminalExecPath', formControlOption:  ['', Validators.required]}],
        ['defaultOpen',  'defaultOpen'],
      ])
    );

    this.mfcFileExplorer = new ModelFormController<FileExplorerSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>()
    );
  }


  openDeleteMasterKeyConfirmationDialog(): void {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: 'Delete master key, if you continue, all existing secrets will be invalid. Do you want continue ?' },
    });

    this.subscriptions.push(dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.masterKeyService.deleteMasterKey();
        this.notification.info('Master Key Deleted');
      }
    }));
  }

  ngOnInit() {
    if (!this.settingService.isLoaded ) {
      this.notification.info('Settings not loaded, we\'ll reload it, please close setting menu and reopen');
      this.settingService.reload();
    }

    this.settingsCopy = this.settingStorage.settings;

    this.generalForm = this.initGeneralForm();
    this.uiForm = this.initUiForm();
    this.terminalForm = this.initTerminalForm();
    this.remoteDesktopForm = this.initRemoteDesktopForm();
    this.fileExplorerForm = this.initFileExplorerForm();

    this.refreshForm(this.settingsCopy);

    this.subscriptions.push(this.settingService.settingLoadedEvent.subscribe(() => {
      this.settingsCopy = this.settingStorage.settings;
      this.refreshForm(this.settingsCopy);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    }));

  }

  private initGeneralForm() {
    return this.mfcGeneral.onInitForm(this.fb);
  }

  private initFileExplorerForm() {
    return this.mfcFileExplorer.onInitForm(this.fb);
  }

  private initRemoteDesktopForm() {
    return this.mfcRemoteDesktop.onInitForm(this.fb);
  }

  private initUiForm() {
    return this.mfcUI.onInitForm(this.fb);
  }

  private initTerminalForm() {
    return this.mfcLocalTerminal.onInitForm(this.fb);
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
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
      this.settingsCopy.remoteDesktop = this.remoteDesktopFormToModel();
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

    this.subscriptions.push(dialogRef.afterClosed().subscribe(result => {
      this.log.debug('Master Key modal was closed');
    }));
  }


  refreshForm(value: any) {
    if (!value) {
      value = new MySettings();
    }

    if(this.generalForm) {
      if (!value.general) {
        value.general = new GeneralSettings();
      }
      this.mfcGeneral.refreshForm(value.general, this.generalForm);
    }

    if (this.uiForm) {
      this.uiForm.reset();
      if (!value.ui) {
        value.ui = new UISettings();
      }
      this.mfcUI.refreshForm(value.ui, this.uiForm);
    }


    if(this.remoteDesktopForm) {
      if (!value.remoteDesktop) {
        value.remoteDesktop = new RemoteDesktopSettings();
      }
      this.mfcRemoteDesktop.refreshForm(value.remoteDesktop, this.remoteDesktopForm);
    }

    if (this.terminalForm) {
      this.terminalForm.reset();
      if (!value.terminal) {
        value.terminal = new TerminalSettings();
      }
      if (!value.terminal.localTerminal) {
        value.terminal.localTerminal = new LocalTerminalProfile();
      }
      this.mfcLocalTerminal.refreshForm(value.terminal.localTerminal, this.terminalForm);
    }

    if(this.fileExplorerForm) {
      this.fileExplorerForm.reset();
      if (!value.fileExplorer) {
        value.fileExplorer = new FileExplorerSettings();
      }
      this.mfcFileExplorer.refreshForm(value.fileExplorer, this.fileExplorerForm);
    }
  }

  shouldDisableSave() {
    return [this.GROUP_TAG_FORM_TAB_INDEX].includes(this.currentTabIndex);
  }


  private uiFormToModel() {
    return this.mfcUI.formToModel(new UISettings(), this.uiForm);
  }

  private generalFormToModel() {
    return this.mfcGeneral.formToModel( new GeneralSettings(), this.generalForm);
  }

  private remoteDesktopFormToModel() {
    return this.mfcRemoteDesktop.formToModel(new RemoteDesktopSettings(), this.remoteDesktopForm);
  }

  private termFormToModel() {
    let term = new TerminalSettings();
    term.localTerminal =  this.mfcLocalTerminal.formToModel(new LocalTerminalProfile(), this.terminalForm);
    return term;
  }

  private fileExplorerFormToModel() {
    return this.mfcFileExplorer.formToModel(new FileExplorerSettings(), this.fileExplorerForm);
  }

  async commitChange() {
    await this.settingService.save(this.settingsCopy);
  }

  filterSecret() {
    return this.secretStorageService.data.secrets?.filter(one => one.secretType == SecretType.LOGIN_PASSWORD);
  }

}
