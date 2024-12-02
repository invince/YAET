import {ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MySettings} from '../../../domain/MySettings';
import {SettingService} from '../../../services/setting.service';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {LocalTerminalProfile, LocalTerminalType} from '../../../domain/LocalTerminalProfile';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatInput} from '@angular/material/input';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {MasterKeyComponent} from '../master-key/master-key.component';
import {ConfirmationComponent} from '../confirmation/confirmation.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {UISettings} from '../../../domain/UISettings';
import {MatChip} from '@angular/material/chips';
import {TagsFormComponent} from '../tags-form/tags-form.component';
import {GroupsFormComponent} from '../groups-form/groups-form.component';
import {MatDivider} from "@angular/material/divider";

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

  form!: FormGroup;

  LOCAL_TERM_OPTIONS = LocalTerminalType;

  private subscription!: Subscription;
  currentTabIndex: number = 0;

  constructor(
    private fb: FormBuilder,
    private settingService: SettingService,
    private settingStorage: SettingStorageService,
    public masterKeyService: MasterKeyService,
    private cdr: ChangeDetectorRef,
    public dialog: MatDialog,
    private _snackBar: MatSnackBar,
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

    this.form = this.initForm();

    this.refreshForm(this.settingStorage.settings);

    this.subscription =  this.settingService.settingLoadedEvent.subscribe(() => {
      this.refreshForm(this.settingStorage.settings);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    })
  }

  private initForm() {
    return this.fb.group(
      {
        localTerminalType: ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        localTerminalExecPath: ['', Validators.required],
        uiProfileLabelLength: ['', Validators.required],
        uiSecretLabelLength: ['', Validators.required],
      },
      {validators: []}
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Clean up the subscription
  }



  override onSave() {
    if (this.form.valid) {
      this.settingService.save(this.formToModel());
    }
  }



  onSelectLocalTerminalType($event: any) {
    let localTerminalSetting = new LocalTerminalProfile();
    localTerminalSetting.type = $event.value;
    this.settingService.validateLocalTerminalSettings(localTerminalSetting);
    this.form.get('localTerminalExecPath')?.setValue(localTerminalSetting.execPath);
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


  refreshForm(value: any) {
    if (this.form) {
      this.form.reset();
      if (!value) {
        value = new MySettings();
      }
      if (!value.localTerminal) {
        value.localTerminal = new LocalTerminalProfile();
      }
      this.form.get('localTerminalType')?.setValue(value.localTerminal.type);
      this.form.get('localTerminalExecPath')?.setValue(value.localTerminal.execPath);

      if (!value.ui) {
        value.ui = new LocalTerminalProfile();
      }
      this.form.get('uiProfileLabelLength')?.setValue(value.ui.profileLabelLength);
      this.form.get('uiSecretLabelLength')?.setValue(value.ui.secretLabelLength);
    }
  }

  formToModel(): MySettings {
    let settings = new MySettings();
    if (!settings.localTerminal) {
      settings.localTerminal = new LocalTerminalProfile();
    }
    settings.localTerminal.type = this.form.get('localTerminalType')?.value;
    settings.localTerminal.execPath = this.form.get('localTerminalExecPath')?.value;

    if (!settings.ui) {
      settings.ui = new UISettings();
    }
    settings.ui.profileLabelLength = this.form.get('uiProfileLabelLength')?.value;
    settings.ui.secretLabelLength = this.form.get('uiSecretLabelLength')?.value;

    return settings;
  }


  shouldDisableSave() {
    return [2,3].includes(this.currentTabIndex);
  }
}
