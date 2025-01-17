import {ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {Profile, ProfileCategory, ProfileCategoryTypeMap, ProfileType} from '../../../domain/profile/Profile';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatInput} from '@angular/material/input';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {RemoteTerminalProfileFormComponent} from './remote-terminal-profile-form/remote-terminal-profile-form.component';
import {ProfileService} from '../../../services/profile.service';
import {IsAChildForm} from '../../enhanced-form-mixin';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SettingService} from '../../../services/setting.service';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {Tag} from '../../../domain/Tag';
import {RemoteTerminalProfile} from '../../../domain/profile/RemoteTerminalProfile';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {RdpProfileFormComponent} from './rdp-profile-form/rdp-profile-form.component';
import {RdpProfile} from '../../../domain/profile/RdpProfile';
import {VncProfileFormComponent} from './vnc-profile-form/vnc-profile-form.component';
import {VncProfile} from '../../../domain/profile/VncProfile';
import {CustomProfileFormComponent} from './custom-profile-form/custom-profile-form.component';
import {CustomProfile} from '../../../domain/profile/CustomProfile';
import {LogService} from '../../../services/log.service';
import {NotificationService} from '../../../services/notification.service';
import {FtpProfileFormComponent} from './ftp-profile-form/ftp-profile-form.component';
import {FTPProfile} from '../../../domain/profile/FTPProfile';
import {SecretType} from '../../../domain/Secret';


@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatChipsModule,
    MatAutocompleteModule,

    MatIcon,
    KeyValuePipe,
    MatInput,

    CdkTextareaAutosize,

    RemoteTerminalProfileFormComponent,
    RdpProfileFormComponent,
    VncProfileFormComponent,
    CustomProfileFormComponent,
    FtpProfileFormComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss'
})
export class ProfileFormComponent extends IsAChildForm(MenuComponent) implements OnInit {

  private _profile!: Profile;

  @Input() buttons = ['close', 'delete', 'save', 'connect']; // 'clone', 'reload'
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileClone = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  groupColor: string | undefined = '';

  readonly addOnBlur = true;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  @ViewChild('tagsAutoCompleteInput') tagsAutoCompleteInput!: ElementRef;
  filteredTags!: Tag[];

  @ViewChild(RemoteTerminalProfileFormComponent) remoteTerminalChild!: RemoteTerminalProfileFormComponent;
  @ViewChild(RdpProfileFormComponent) rdpChild!: RdpProfileFormComponent;
  @ViewChild(VncProfileFormComponent) vncChild!: VncProfileFormComponent;
  @ViewChild(CustomProfileFormComponent) customChild!: CustomProfileFormComponent;
  @ViewChild(FtpProfileFormComponent) ftpChild!: FtpProfileFormComponent;

  constructor(
    private log: LogService,

    private fb: FormBuilder,
    private profileService: ProfileService,
    public masterKeyService: MasterKeyService, // in html
    public settingStorage: SettingStorageService, // in html
    private settingService: SettingService,

    private notification: NotificationService,
    private cdr: ChangeDetectorRef,
  ) {
    super();

    if (!this.profileService.isLoaded ) {
      this.notification.info('Profiles not loaded, we\'ll reload it, please close setting menu and reopen');
      this.profileService.reload();
    }
  }

  get profile(): Profile {
    return this._profile;
  }
  @Input()
  set profile(value: Profile) {
    this._profile = value;
    this.refreshForm(value);
  }

  override afterFormInitialization() { // we cannot relay only on setter, because 1st set it before ngOnInit
    this.refreshForm(this.profile);
  }


  onInitForm(): FormGroup {
    return this.fb.group(
      {
        name: [this._profile.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        comment: [this._profile.comment],
        category: [this._profile.category, Validators.required],
        group: [],
        tags: [[]],
        profileType: [this._profile.profileType, Validators.required],
        remoteTerminalProfileForm: [],
        ftpProfileForm: [this._profile.ftpProfile],
        rdpProfileForm: [this._profile.rdpProfile],
        vncProfileForm: [this._profile.vncProfile],
        customProfileForm: [this._profile.customProfile],

      },
      {validators: []}
    );
  }

  onSelectCategory($event: MatSelectChange) {
    let cat = $event.value;
    if (cat == ProfileCategory.CUSTOM) {
      this.form.get('customProfileForm')?.setValue(new CustomProfile());
      this.form.patchValue({
        profileType: 'CUSTOM', // Reset dependent fields if needed
      });
    } else {
      this.form.patchValue({
        profileType: null, // Reset dependent fields if needed
      });
    }
  }

  onSelectType($event: MatSelectChange) {
    // this.profile.profileType = $event;
    switch($event.value) {
      case ProfileType.SSH_TERMINAL:
      case ProfileType.SCP_FILE_EXPLORER:
        this.form.get('remoteTerminalProfileForm')?.setValue(new RemoteTerminalProfile());
        break;
      case ProfileType.TELNET_TERMINAL:
        this.form.get('remoteTerminalProfileForm')?.setValue(new RemoteTerminalProfile(23));
        break;
      case ProfileType.WIN_RM_TERMINAL:
        this.form.get('remoteTerminalProfileForm')?.setValue(new RemoteTerminalProfile(5985));
        break;
      case ProfileType.FTP_FILE_EXPLORER:
        this.form.get('ftpProfileForm')?.setValue(new FTPProfile());
        break;

      case ProfileType.RDP_REMOTE_DESKTOP:
        this.form.get('rdpProfileForm')?.setValue(new RdpProfile());
        break;

      case ProfileType.VNC_REMOTE_DESKTOP:
        this.form.get('vncProfileForm')?.setValue(new VncProfile());
        break;
    }
  }

  override refreshForm(profile: any) {
    if (this.form) {
      this.form.reset();


      this.form.get('name')?.setValue(profile?.name);
      this.form.get('comment')?.setValue(profile?.comment);
      if (profile?.group) {
        let group = this.settingService.findGroupById(profile.group);
        this.form.get('group')?.setValue(group);
        this.groupColor = group?.color;
      } else {
        this.groupColor = '';
      }

      this.form.get('tags')?.setValue([]);
      if (profile?.tags) {
        for (let tagId of profile.tags) {
          let tag = this.settingService.findTagById(tagId);
          if (tag) {
            this.form.get('tags')?.value.push(tag);
          }
        }
        this.form.get('tags')?.updateValueAndValidity();
      }
      this.form.get('category')?.setValue(profile?.category);
      this.form.get('profileType')?.setValue(profile?.profileType);

      if (profile?.category == ProfileCategory.CUSTOM) {
        this.updateFormValue('customProfileForm', profile?.customProfile);
      } else if (profile?.profileType) {
        switch (profile.profileType) {
          case ProfileType.SSH_TERMINAL:
          case ProfileType.SCP_FILE_EXPLORER:
            this.updateFormValue('remoteTerminalProfileForm', profile?.sshProfile);
            break;
          case ProfileType.TELNET_TERMINAL:
            this.updateFormValue('remoteTerminalProfileForm', profile?.telnetProfile);
            break;
          case ProfileType.WIN_RM_TERMINAL:
            this.updateFormValue('remoteTerminalProfileForm', profile?.winRmProfile);
            break;
          case ProfileType.FTP_FILE_EXPLORER:
            this.updateFormValue('ftpProfileForm', profile?.ftpProfile);
            break;
          case ProfileType.RDP_REMOTE_DESKTOP:
            this.updateFormValue('rdpProfileForm', profile?.rdpProfile);
            break;
          case ProfileType.VNC_REMOTE_DESKTOP:
            this.updateFormValue('vncProfileForm', profile?.vncProfile);
            break;
        }
      }

      this.onSubmit(); // Reset the dirty state
      // this.filteredTags = this.settingStorage.settings.tags;
    }
  }

  formToModel(): Profile {
    this._profile.name = this.form.get('name')?.value;
    this._profile.comment = this.form.get('comment')?.value;
    this._profile.group = this.form.get('group')?.value?.id;
    let tags = this.form.get('tags')?.value;
    if (tags && Array.isArray(tags)) {
      this._profile.tags = tags.map(one => one.id);
    }

    this._profile.category = this.form.get('category')?.value;
    if (this._profile.category == ProfileCategory.CUSTOM) {
      this._profile.profileType = ProfileType.CUSTOM;
      this._profile.customProfile = this.customChild?.formToModel();
    } else {
      this._profile.profileType = this.form.get('profileType')?.value;
    }

    switch (this._profile.profileType) {
      case ProfileType.SSH_TERMINAL:
      case ProfileType.SCP_FILE_EXPLORER:
        this._profile.sshProfile = this.remoteTerminalChild?.formToModel();
        break;
      case ProfileType.TELNET_TERMINAL:
        this._profile.telnetProfile = this.remoteTerminalChild?.formToModel();
        break;
      case ProfileType.WIN_RM_TERMINAL:
        this._profile.winRmProfile = this.remoteTerminalChild?.formToModel();
        break;
      case ProfileType.FTP_FILE_EXPLORER:
        this._profile.ftpProfile = this.ftpChild?.formToModel();
        break;
      case ProfileType.RDP_REMOTE_DESKTOP:
        this._profile.rdpProfile = this.rdpChild?.formToModel();
        break;
      case ProfileType.VNC_REMOTE_DESKTOP:
        this._profile.vncProfile = this.vncChild?.formToModel();
        break;
    }
    return this._profile;
  }





  getTypeOptions() {
    const selectedCategory = this.form.get('category')?.value; // we work with formGroup, so ngModel to bind profile doesn't work
    return this.CATEGORY_TYPE_MAP.get(selectedCategory);
  }

  override onSave() {
    if (this.form.valid) {
      this.onSubmit(); // Reset the dirty state
      this.onProfileSave.emit(this.formToModel());
    }
  }

  onClone() {
    if (this.form.valid) {
      this.onSubmit(); // Reset the dirty state
      this.onProfileClone.emit(this.formToModel());
    }
  }

  onConnect() {
    if (this.form.valid) {
      this.profileService.onProfileConnect(this.formToModel());

      this.onSubmit(); // Reset the dirty state
      this.closeEvent.emit();
    }
  }



  updateFormValue(formName:string, value: any) {
    this.form.get(formName)?.setValue(value);
    this.form.get(formName)?.markAsUntouched();
    this.form.get(formName)?.markAsPristine();
  }




  onDelete() {
    this.onProfileDelete.emit(this.formToModel());
  }

  onClose() {
    this.onProfileCancel.emit();
  }


  addTag($event: MatChipInputEvent) {
  }

  onSelectGroup($event: MatSelectChange) {
    this.groupColor = $event?.value?.color;
  }

  removeTag(tag: Tag) {
    if (!tag) {
      return;
    }
    const currentTags = this.form.get('tags')?.value || [];
    this.form.get('tags')?.setValue(currentTags.filter((one: Tag) => one.id != tag.id));
    this.form.get('tags')?.markAsDirty(); // force to dirty
    this.form.get('tags')?.updateValueAndValidity();
  }

  selectTag($event: MatAutocompleteSelectedEvent) {
    const selectedTag = $event.option.value;
    this.log.debug('Selected Tag:' + selectedTag);

    const currentTags = this.form.get('tags')?.value || [];
    this.form.get('tags')?.setValue([...currentTags, selectedTag]);
    this.tagsAutoCompleteInput.nativeElement.value = '';
    $event.option.deselect();
  }


  updateFilteredTag($event: Event) {
    const inputElement = $event.target as HTMLInputElement;
    const inputValue = inputElement.value;
    if (!inputValue) {
      return;
    }
    const currentFilter = inputValue.toLowerCase();
    const selected = this.form.get('tags')?.value;

    let excludeAlreadySelected = this.settingStorage.settings.tags;
    if (selected) {
      const selectedId = selected.map((one: Tag) => one.id);
      excludeAlreadySelected = excludeAlreadySelected.filter(one => !selectedId.includes(one.id));
    }

    this.filteredTags = currentFilter
      ? excludeAlreadySelected.filter(one => one.name.toLowerCase().includes(currentFilter))
      : excludeAlreadySelected.slice();

    // Force change detection
    this.cdr.detectChanges();
  }


  onReload() {
    this.profileService.reload();
  }

  protected readonly SecretType = SecretType;
}
