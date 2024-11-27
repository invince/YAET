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
  ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  form!: FormGroup;

  LOCAL_TERM_OPTIONS = LocalTerminalType;

  private subscription!: Subscription;

  constructor(
    private fb: FormBuilder,
    private settingService: SettingService,
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

    this.refreshForm(this.settingService.settings);

    this.subscription =  this.settingService.settingLoadedEvent.subscribe(() => {
      this.refreshForm(this.settingService.settings);
      this.cdr.detectChanges(); // mat select doesn't detect well change from event subscription
    })
  }

  private initForm() {
    return this.fb.group(
      {
        localTerminalType: ['', [Validators.required]], // we shall avoid use ngModel and formControl at same time
        localTerminalExecPath: ['', Validators.required],

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
      this.form.get('localTerminalType')?.setValue(value?.localTerminalSetting.type);
      this.form.get('localTerminalExecPath')?.setValue(value?.localTerminalSetting.execPath);
    }
  }

  formToModel(): MySettings {
    let settings = new MySettings();
    if (!settings.localTerminalSetting) {
      settings.localTerminalSetting = new LocalTerminalProfile();
    }
    settings.localTerminalSetting.type = this.form.get('localTerminalType')?.value;
    settings.localTerminalSetting.execPath = this.form.get('localTerminalExecPath')?.value;


    return settings;
  }


}
