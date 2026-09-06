import {CommonModule, KeyValuePipe} from '@angular/common';
import {ChangeDetectorRef, Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {NgxSpinnerService} from 'ngx-spinner';
import {Observable, of, Subject, Subscription} from 'rxjs';
import {debounceTime, finalize, switchMap, takeUntil, tap} from 'rxjs/operators';
import packageJson from '../../../../../package.json';
import {LocalTerminalProfile, LocalTerminalType} from '../../../domain/profile/LocalTerminalProfile';
import {Proxy} from '../../../domain/Proxy';
import {SecretType} from '../../../domain/Secret';
import {AiMode, AiSettings} from '../../../domain/setting/AiSettings';
import {AiService} from '../../../services/ai.service';
import {FileExplorerSettings} from '../../../domain/setting/FileExplorerSettings';
import {GeneralSettings} from '../../../domain/setting/GeneralSettings';
import {MySettings} from '../../../domain/setting/MySettings';
import {RemoteDesktopSettings} from '../../../domain/setting/RemoteDesktopSettings';
import {TerminalSettings} from '../../../domain/setting/TerminalSettings';
import {SideNavType, UISettings} from '../../../domain/setting/UISettings';
import {ElectronService} from '../../../services/electron/electron.service';
import {LogService} from '../../../services/log.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {NotificationService} from '../../../services/notification.service';
import {ProxyService} from '../../../services/proxy.service';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SecretService} from '../../../services/secret.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SettingService} from '../../../services/setting.service';
import {
  FormFieldWithPrecondition,
  ModelFieldWithPrecondition,
  ModelFormController
} from '../../../utils/ModelFormController';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MasterKeyComponent} from '../../dialog/master-key/master-key.component';
import {ExamplePluginInstallComponent} from '../../dialog/example-plugin-install/example-plugin-install.component';
import {MenuComponent} from '../menu.component';
import {GroupsFormComponent} from './groups-form/groups-form.component';
import {TagsFormComponent} from './tags-form/tags-form.component';
import {PluginLoaderService} from '../../../plugin/services/plugin-loader.service';


@Component({
  selector: 'app-setting-menu',
  imports: [
    TagsFormComponent,
    GroupsFormComponent,
    MatDialogModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatIcon,
    MatIconButton,
    MatFormFieldModule,
    MatSelectModule,
    KeyValuePipe,
    MatInputModule,
    MatButton,
    MatCheckbox,
    MatExpansionModule,
    TranslateModule,
  ],
  templateUrl: './setting-menu.component.html',
    styleUrl: './setting-menu.component.scss'
})
export class SettingMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  generalForm!: FormGroup;
  uiForm!: FormGroup;
  terminalForm!: FormGroup;
  remoteDesktopForm!: FormGroup;
  fileExplorerForm!: FormGroup;
  aiForm!: FormGroup;

  LOCAL_TERM_OPTIONS: LocalTerminalType[] = this.getLocalTermOptions();

  LANGUAGE_OPTIONS = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'zh', name: '中文' }
  ];

  SIDE_NAV_TYPE_OPTIONS = SideNavType;

  THEME_OPTIONS = [
    { value: 'pink-bluegrey', label: 'Pink & Blue-Grey (Dark)' },
    { value: 'purple-green', label: 'Purple & Green (Dark)' },
    { value: 'indigo-pink', label: 'Indigo & Pink (Light)' },
    { value: 'deeppurple-amber', label: 'Deep Purple & Amber (Light)' },
  ];

  MODE_OPTIONS = [
    { value: 'web' as AiMode, label: 'Web Provider' },
    { value: 'acp' as AiMode, label: 'ACP' },
  ];

  aiModelOptions: string[] = [];
  isLoadingModels = false;
  acpModelOptions: string[] = [];
  isLoadingAcpModels = false;

  plugins: any[] = [];

  proxies: Proxy[] = [];

  settingsCopy!: MySettings;
  private subscriptions: Subscription[] = [];
  private destroy$ = new Subject<void>();
  currentTabIndex: number = 0;

  GENERAL_FORM_TAB_INDEX = 0;
  UI_FORM_TAB_INDEX = 1;
  GROUP_FORM_TAB_INDEX = 2;
  TAG_FORM_TAB_INDEX = 3;
  TERM_FORM_TAB_INDEX = 4;
  REMOTE_DESKTOP_FORM_TAB_INDEX = 5;
  FILE_EXPLORER_FORM_TAB_INDEX = 6;
  AI_FORM_TAB_INDEX = 7;
  PLUGINS_FORM_TAB_INDEX = 8;

  version = '';

  private mfcGeneral: ModelFormController<GeneralSettings>;
  private mfcUI: ModelFormController<UISettings>;
  private mfcRemoteDesktop: ModelFormController<RemoteDesktopSettings>;
  private mfcLocalTerminal: ModelFormController<LocalTerminalProfile>;
  private mfcFileExplorer: ModelFormController<FileExplorerSettings>;
  private mfcAi: ModelFormController<AiSettings>;

  constructor(
    private log: LogService,
    private fb: FormBuilder,
    private electronService: ElectronService,
    private aiService: AiService,
    private settingService: SettingService,
    private settingStorage: SettingStorageService,
    private secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public proxyService: ProxyService,
    public masterKeyService: MasterKeyService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private notification: NotificationService,
    private spinner: NgxSpinnerService,
    @Inject(TranslateService) private translate: TranslateService,
    private pluginLoader: PluginLoaderService
  ) {
    super();
    this.version = packageJson.version;


    this.mfcGeneral = new ModelFormController<GeneralSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['autoUpdate', 'autoUpdate'],
        ['language', { name: 'language', formControlOption: ['', Validators.required] }],
        ['proxyId', 'proxyId'],
      ])
    );

    this.mfcUI = new ModelFormController<UISettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['profileLabelLength', { name: 'uiProfileLabelLength', formControlOption: ['', Validators.required] }],
        ['profileSideNavType', { name: 'profileSideNavType', formControlOption: ['', Validators.required] }],
        ['secretLabelLength', { name: 'uiSecretLabelLength', formControlOption: ['', Validators.required] }],
        ['secretLabelLengthInDropDown', { name: 'uiSecretLabelLengthInDropDown', formControlOption: ['', Validators.required] }],
        ['theme', { name: 'theme', formControlOption: ['', Validators.required] }],
      ])
    );

    this.mfcRemoteDesktop = new ModelFormController<RemoteDesktopSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['vncClipboardCompatibleMode', 'vncClipboardCompatibleMode'],
        ['vncCompressionLevel', { name: 'vncCompressionLevel', formControlOption: ['', [Validators.required, Validators.min(0), Validators.max(9)]] }],
        ['vncQuality', { name: 'vncQuality', formControlOption: ['', [Validators.required, Validators.min(1), Validators.max(9)]] }],
      ])
    );


    this.mfcLocalTerminal = new ModelFormController<LocalTerminalProfile>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['type', { name: 'localTerminalType', formControlOption: ['', Validators.required] }],
        ['execPath', { name: 'localTerminalExecPath', formControlOption: ['', Validators.required] }],
        ['defaultOpen', 'defaultOpen'],
      ])
    );

    this.mfcFileExplorer = new ModelFormController<FileExplorerSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>()
    );

    this.mfcAi = new ModelFormController<AiSettings>(
      new Map<string | ModelFieldWithPrecondition, string | FormFieldWithPrecondition>([
        ['mode', { name: 'aiMode', formControlOption: [''] }],
        ['apiUrl', { name: 'aiApiUrl', formControlOption: [''] }],
        ['token', { name: 'aiToken', formControlOption: [''] }],
        ['model', { name: 'aiModel', formControlOption: [''] }],
        ['acpCommand', { name: 'acpCommand', formControlOption: [''] }],
        ['acpArgs', { name: 'acpArgs', formControlOption: [''] }],
        ['acpModel', { name: 'acpModel', formControlOption: [''] }],
        ['useContext', { name: 'aiUseContext', formControlOption: [true] }],
        ['agentMode', { name: 'aiAgentMode', formControlOption: [false] }],
        ['crossSessionAccess', { name: 'aiCrossSessionAccess', formControlOption: [false] }],
        ['contextMaxLines', { name: 'aiContextMaxLines', formControlOption: ['', [Validators.required, Validators.min(10)]] }],
      ])
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
    if (!this.settingService.isLoaded) {
      this.notification.info('Settings not loaded, we\'ll reload it, please close setting menu and reopen');
      this.settingService.reload();
    }

    if (!this.proxyService.isLoaded) {
      this.proxyService.reload();
    }
    this.proxies = this.proxyService.proxies;

    this.loadPlugins();

    this.settingsCopy = this.settingStorage.settings;

    this.generalForm = this.initGeneralForm();
    this.uiForm = this.initUiForm();
    this.terminalForm = this.initTerminalForm();
    this.remoteDesktopForm = this.initRemoteDesktopForm();
    this.fileExplorerForm = this.initFileExplorerForm();
    this.aiForm = this.initAiForm();

    this.refreshForm(this.settingsCopy);

    this.subscriptions.push(
      this.aiForm.get('aiApiUrl')!.valueChanges.pipe(
        takeUntil(this.destroy$),
        debounceTime(600),
        switchMap(() => this.fetchAiModels()),
      ).subscribe(),
      this.aiForm.get('aiToken')!.valueChanges.pipe(
        takeUntil(this.destroy$),
        debounceTime(600),
        switchMap(() => this.fetchAiModels()),
      ).subscribe(),
      this.aiForm.get('acpCommand')!.valueChanges.pipe(
        takeUntil(this.destroy$),
        debounceTime(600),
        switchMap(() => this.fetchAcpModels()),
      ).subscribe(),
    );

    this.subscriptions.push(this.settingService.settingLoadedEvent.subscribe(() => {
      this.settingsCopy = this.settingStorage.settings;
      this.refreshForm(this.settingsCopy);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
      this.spinner.hide();
    }));

  }

  onRefreshAiModels() {
    this.fetchAiModels().subscribe();
  }

  onRefreshAcpModels() {
    this.fetchAcpModels().subscribe();
  }

  fetchAiModels(): Observable<string[]> {
    if (this.aiForm.get('aiMode')?.value !== 'web') return of([] as string[]);
    const url = this.aiForm.get('aiApiUrl')?.value;
    const token = this.aiForm.get('aiToken')?.value;
    if (!url || !token) return of([] as string[]);
    this.isLoadingModels = true;
    return this.aiService.fetchModels(url, token).pipe(
      tap({ next: (models) => {
        this.aiModelOptions = models;
        const currentModel = this.aiForm.get('aiModel')?.value;
        if (!currentModel && models.length > 0) {
          this.aiForm.get('aiModel')?.setValue(models[0]);
        }
      }}),
      finalize(() => { this.isLoadingModels = false; this.cdr.detectChanges(); }),
    );
  }

  fetchAcpModels(): Observable<string[]> {
    if (this.aiForm.get('aiMode')?.value !== 'acp') return of([] as string[]);
    const command = this.aiForm.get('acpCommand')?.value;
    const args = this.aiForm.get('acpArgs')?.value;
    if (!command) return of([] as string[]);
    this.isLoadingAcpModels = true;
    return this.aiService.fetchAcpModels(command, args).pipe(
      tap({ next: (models) => {
        this.acpModelOptions = models;
        const currentModel = this.aiForm.get('acpModel')?.value;
        if (!currentModel && models.length > 0) {
          this.aiForm.get('acpModel')?.setValue(models[0]);
        }
      }}),
      tap({ error: (err) => {
        this.notification.error('Failed to fetch ACP models: ' + (err.message || err));
      }}),
      finalize(() => { this.isLoadingAcpModels = false; this.cdr.detectChanges(); }),
    );
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

  private initAiForm() {
    return this.mfcAi.onInitForm(this.fb);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    if (this.currentTabIndex == this.AI_FORM_TAB_INDEX && this.aiForm.valid) {
      this.settingsCopy.ai = this.aiFormToModel();
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
    if (this.currentTabIndex == this.AI_FORM_TAB_INDEX) {
      return this.aiForm.valid;
    }
    if (this.currentTabIndex == this.FILE_EXPLORER_FORM_TAB_INDEX) {
      return this.fileExplorerForm.valid;
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
    // spinner will be hidden when settingLoadedEvent fires
  }

  async loadPlugins() {
    try {
      const ipc = (window as any).electronAPI;
      if (ipc) {
        this.plugins = await ipc.invoke('plugins.list');
      }
    } catch (err) {
      console.error('[Settings] Failed to load plugins:', err);
    }
  }

  async reloadExternalPlugins() {
    try {
      await this.pluginLoader.reloadExternalPlugins();
      await this.loadPlugins();
    } catch (err) {
      console.error('[Settings] Failed to reload external plugins:', err);
    }
  }

  /**
   * Open the "Install Example Plugins" checklist dialog. After install, refresh
   * the plugin list so newly copied (still-disabled) plugins appear, ready for
   * the user to Enable.
   */
  openExampleInstallDialog() {
    const dialogRef = this.dialog.open(ExamplePluginInstallComponent, {
      width: '560px',
      panelClass: 'example-plugin-dialog',
    });
    this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
      if (result && Array.isArray(result.installed) && result.installed.length > 0) {
        const ok = result.installed.filter((r: any) => r?.ok);
        const fail = result.installed.filter((r: any) => !r?.ok);
        if (ok.length > 0) {
          this.notification.success(this.translate.instant('SETTINGS.PLUGIN_INSTALLED_N', { n: ok.length }));
        }
        if (fail.length > 0) {
          this.notification.error(this.translate.instant('SETTINGS.PLUGIN_INSTALL_FAIL', { n: fail.length }));
        }
        await this.loadPlugins();
      }
    }));
  }

  /**
   * Enable or disable an external plugin, then hot-reload so it takes effect
   * immediately. Bundled plugins cannot be toggled here.
   */
  async togglePluginEnabled(plugin: any) {
    try {
      const ipc = (window as any).electronAPI;
      if (!ipc) return;
      const action = plugin.enabled ? 'plugins.disable' : 'plugins.enable';
      const result = await ipc.invoke(action, plugin.id);
      if (!result?.ok) {
        const reason = result?.reason === 'not-external'
          ? this.translate.instant('SETTINGS.PLUGIN_BUNDLED_CANNOT')
          : result?.reason === 'unknown-plugin'
            ? this.translate.instant('SETTINGS.PLUGIN_UNKNOWN')
            : this.translate.instant('SETTINGS.PLUGIN_OP_FAIL');
        this.notification.error(reason);
        return;
      }
      const msgKey = plugin.enabled ? 'SETTINGS.PLUGIN_DISABLED' : 'SETTINGS.PLUGIN_ENABLED';
      this.notification.success(this.translate.instant(msgKey, { name: plugin.name }));
      // Re-read the merged manifest and reload external plugin frontends into the
      // PluginRegistryService, so newly-enabled plugins become selectable as profile
      // types immediately (not only after an app restart).
      await this.pluginLoader.reloadExternalPlugins();
      await this.loadPlugins();
    } catch (err) {
      console.error('[Settings] Failed to toggle plugin:', err);
      this.notification.error(this.translate.instant('SETTINGS.PLUGIN_TOGGLE_FAIL'));
    }
  }


  checkForUpdates() {
    this.notification.info('Checking for updates...');
    this.electronService.checkForUpdates();
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

    if (this.generalForm) {
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


    if (this.remoteDesktopForm) {
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

    if (this.fileExplorerForm) {
      this.fileExplorerForm.reset();
      if (!value.fileExplorer) {
        value.fileExplorer = new FileExplorerSettings();
      }
      this.mfcFileExplorer.refreshForm(value.fileExplorer, this.fileExplorerForm);
    }

    if (this.aiForm) {
      this.aiForm.reset();
      if (!value.ai) {
        value.ai = new AiSettings();
      }
      this.mfcAi.refreshForm(value.ai, this.aiForm);
    }
  }

  shouldDisableSave() {
    return [this.GROUP_FORM_TAB_INDEX, this.TAG_FORM_TAB_INDEX, this.PLUGINS_FORM_TAB_INDEX].includes(this.currentTabIndex);
  }


  private uiFormToModel() {
    return this.mfcUI.formToModel(new UISettings(), this.uiForm);
  }

  private generalFormToModel() {
    return this.mfcGeneral.formToModel(new GeneralSettings(), this.generalForm);
  }

  private remoteDesktopFormToModel() {
    return this.mfcRemoteDesktop.formToModel(new RemoteDesktopSettings(), this.remoteDesktopForm);
  }

  private termFormToModel() {
    let term = new TerminalSettings();
    term.localTerminal = this.mfcLocalTerminal.formToModel(new LocalTerminalProfile(), this.terminalForm);
    return term;
  }

  private fileExplorerFormToModel() {
    return this.mfcFileExplorer.formToModel(new FileExplorerSettings(), this.fileExplorerForm);
  }

  private aiFormToModel() {
    return this.mfcAi.formToModel(new AiSettings(), this.aiForm);
  }

  async commitChange() {
    await this.settingService.save(this.settingsCopy);
  }

  onSelectAiMode($event: any) {
    this.aiForm.markAsDirty();
  }

  onClearAiSettings() {
    this.aiForm.reset(new AiSettings());
    this.aiForm.markAsDirty();
  }

  filterSecret() {
    return this.secretStorageService.filter(one => one.secretType == SecretType.LOGIN_PASSWORD);
  }

  onLanguageChange($event: any) {
    this.translate.use($event.value);
  }

  getLocalTermOptions(): LocalTerminalType[] {
    const isWin32 = (window as any).electronAPI?.platform === 'win32';
    if (isWin32) {
      return [LocalTerminalType.CMD, LocalTerminalType.POWERSHELL, LocalTerminalType.POWERSHELL_7, LocalTerminalType.BASH];
    } else {
      return [LocalTerminalType.BASH];
    }
  }

}
