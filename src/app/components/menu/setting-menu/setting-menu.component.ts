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
import {MasterKeyComponent} from '../master-key/master-key.component';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SideNavType, UISettings} from '../../../domain/setting/UISettings';
import {MatChip} from '@angular/material/chips';
import {TagsFormComponent} from '../tags-form/tags-form.component';
import {GroupsFormComponent} from '../groups-form/groups-form.component';
import {MatDivider} from "@angular/material/divider";
import {GeneralSettings} from '../../../domain/setting/GeneralSettings';
import {NgxSpinnerService} from 'ngx-spinner';

@Component({
  selector: 'app-setting-menu',
  standalone: true,
    imports: [
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
        MatChip,
        TagsFormComponent,
        GroupsFormComponent,
        MatDivider,
    ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  localTermForm!: FormGroup;
  uiForm!: FormGroup;

  LOCAL_TERM_OPTIONS = LocalTerminalType;

  SIDE_NAV_TYPE_OPTIONS = SideNavType;

  private subscription!: Subscription;
  currentTabIndex: number = 0;

  GENERAL_FORM_TAB_INDEX = 0;
  UI_FORM_TAB_INDEX = 1;
  GROUP_FORM_TAB_INDEX = 2;
  TAG_FORM_TAB_INDEX = 3;
  LOCAL_TERM_FORM_TAB_INDEX = 4;

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

    this.uiForm = this.initUiForm();
    this.localTermForm = this.initLocalTermForm();

    this.refreshForm(this.settingStorage.settings);

    this.subscription =  this.settingService.settingLoadedEvent.subscribe(() => {
      this.refreshForm(this.settingStorage.settings);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    })
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
  private initLocalTermForm() {
    return this.fb.group(
      {
        localTerminalType:        ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        localTerminalExecPath:    ['', Validators.required],
      },
      {validators: []}
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Clean up the subscription
  }



  override onSave() {
    if (this.currentTabIndex == this.GENERAL_FORM_TAB_INDEX) {
      this.settingService.saveGeneralConfig(this.generalFormToModel());
    }
    if (this.currentTabIndex == this.UI_FORM_TAB_INDEX && this.uiForm.valid) {
      this.settingService.saveUiConfig(this.uiFormToModel());
    }
    if (this.currentTabIndex == this.LOCAL_TERM_FORM_TAB_INDEX && this.localTermForm.valid) {
      this.settingService.saveLocalTermConfig(this.localTermFormToModel());
    }
  }

  currentFormValid(): boolean {
    if (this.currentTabIndex == this.GENERAL_FORM_TAB_INDEX) {
      return true;
    }
    if (this.currentTabIndex == this.UI_FORM_TAB_INDEX) {
      return this.uiForm.valid;
    }
    if (this.currentTabIndex == this.LOCAL_TERM_FORM_TAB_INDEX) {
      return this.localTermForm.valid;
    }
    return false;
  }


  onSelectLocalTerminalType($event: any) {
    let localTerminalSetting = new LocalTerminalProfile();
    localTerminalSetting.type = $event.value;
    this.settingService.validateLocalTerminalSettings(localTerminalSetting);
    this.localTermForm.get('localTerminalExecPath')?.setValue(localTerminalSetting.execPath);
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

    if (this.uiForm) {
      this.uiForm.reset();
      if (!value.ui) {
        value.ui = new UISettings();
      }
      this.uiForm.get('uiProfileLabelLength')?.setValue(value.ui.profileLabelLength);
      this.uiForm.get('uiSecretLabelLength')?.setValue(value.ui.secretLabelLength);
      this.uiForm.get('uiSecretLabelLengthInDropDown')?.setValue(value.ui.uiSecretLabelLengthInDropDown);
      this.uiForm.get('profileSideNavType')?.setValue(value.ui.profileSideNavType);
    }

    if (this.localTermForm) {
      this.localTermForm.reset();
      if (!value.localTerminal) {
        value.localTerminal = new LocalTerminalProfile();
      }
      this.localTermForm.get('localTerminalType')?.setValue(value.localTerminal.type);
      this.localTermForm.get('localTerminalExecPath')?.setValue(value.localTerminal.execPath);
    }
  }

  shouldDisableSave() {
    return [this.GROUP_FORM_TAB_INDEX, this.TAG_FORM_TAB_INDEX].includes(this.currentTabIndex);
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
    return new GeneralSettings();
  }

  private localTermFormToModel() {
    let localTerminal = new LocalTerminalProfile();
    localTerminal.type = this.localTermForm.get('localTerminalType')?.value;
    localTerminal.execPath = this.localTermForm.get('localTerminalExecPath')?.value;
    return localTerminal;
  }


}
