import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {Component, ElementRef, EventEmitter, forwardRef, Input, OnInit, Output, ViewChild} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {MatButtonModule} from '@angular/material/button';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {Profile, ProfileCategory, ProfileCategoryTypeMap, ProfileType} from '../../../domain/profile/Profile';
import {SecretType} from '../../../domain/Secret';
import {Tag} from '../../../domain/Tag';
import {LogService} from '../../../services/log.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {ProfileService} from '../../../services/profile.service';
import {ProxyStorageService} from '../../../services/proxy-storage.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SettingService} from '../../../services/setting.service';
import {ChildFormAsFormControl} from '../../EnhancedFormMixin';
import {MenuComponent} from '../menu.component';
import {CustomProfileFormComponent} from './custom-profile-form/custom-profile-form.component';
import {FtpProfileFormComponent} from './ftp-profile-form/ftp-profile-form.component';
import {RdpProfileFormComponent} from './rdp-profile-form/rdp-profile-form.component';
import {
  RemoteTerminalProfileFormComponent
} from './remote-terminal-profile-form/remote-terminal-profile-form.component';
import {SambaFormComponent} from './samba-form/samba-form.component';
import {VncProfileFormComponent} from './vnc-profile-form/vnc-profile-form.component';

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
    SambaFormComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ProfileFormComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => ProfileFormComponent), multi: true }
  ]
})
export class ProfileFormComponent extends ChildFormAsFormControl(MenuComponent) implements OnInit {

  private _profile!: Profile;

  @Input() buttons = ['close', 'delete', 'save', 'connect'];
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileClone = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;
  SecretType = SecretType;
  TELNET_SUPPORTED_SECRETS = [SecretType.LOGIN_PASSWORD];
  WINRM_SUPPORTED_SECRETS = [SecretType.LOGIN_PASSWORD];

  groupColor: string | undefined = '';
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  @ViewChild('tagsAutoCompleteInput') tagsAutoCompleteInput!: ElementRef<HTMLInputElement>;
  filteredTags: Tag[] = [];

  constructor(
    private log: LogService,
    private fb: FormBuilder,
    private profileService: ProfileService,
    public masterKeyService: MasterKeyService,
    public settingStorage: SettingStorageService,
    public proxyStorage: ProxyStorageService,
    private settingService: SettingService,
  ) {
    super();
  }

  override onInitForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      group: [''],
      tags: [[]],
      proxyId: [''],
      comment: [''],
      category: [ProfileCategory.TERMINAL, Validators.required],
      profileType: [ProfileType.LOCAL_TERMINAL, Validators.required],
      remoteTerminalProfileForm: [null],
      rdpProfileForm: [null],
      vncProfileForm: [null],
      ftpProfileForm: [null],
      sambaProfileForm: [null],
      customProfileForm: [null],
    });
  }

  // CVA overrides Instead of @Input
  override writeValue(value: Profile): void {
    if (value) {
      this._profile = value;
      super.writeValue(value);
    }
  }

  get profile(): Profile {
    return this._profile;
  }

  override refreshForm(profile: Profile) {
    if (!profile || !this.form) return;
    this.groupColor = profile.group ? (this.settingStorage.settings.groups.find(g => g.id === profile.group)?.color || '') : '';

    // No tags needed.

    this.form.patchValue({
      name: profile.name,
      comment: profile.comment,
      category: profile.category,
      profileType: profile.profileType,
      group: this.settingStorage.settings.groups.find(g => g.id === profile.group) || '',
      tags: (profile.tags || []).map((tId: any) => typeof tId === 'string' ? this.settingStorage.settings.tags.find(t => t.id === tId) : tId).filter(t => t),
      proxyId: profile.proxyId,
      remoteTerminalProfileForm: ['SSH_TERMINAL', 'TELNET_TERMINAL', 'WIN_RM_TERMINAL', 'SCP_FILE_EXPLORER'].includes(profile.profileType) ?
                                 (profile.profileType === ProfileType.SSH_TERMINAL || profile.profileType === ProfileType.SCP_FILE_EXPLORER ? profile.sshProfile :
                                  profile.profileType === ProfileType.TELNET_TERMINAL ? profile.telnetProfile : profile.winRmProfile) : null,
      rdpProfileForm: profile.profileType === ProfileType.RDP_REMOTE_DESKTOP ? profile.rdpProfile : null,
      vncProfileForm: profile.profileType === ProfileType.VNC_REMOTE_DESKTOP ? profile.vncProfile : null,
      ftpProfileForm: profile.profileType === ProfileType.FTP_FILE_EXPLORER ? profile.ftpProfile : null,
      sambaProfileForm: profile.profileType === ProfileType.SAMBA_FILE_EXPLORER ? profile.sambaProfile : null,
      customProfileForm: profile.category === ProfileCategory.CUSTOM ? profile.customProfile : null,
    });
    this.form.markAsPristine();
    this.updateFilteredTag(null);
  }

  override formToModel(): void {
    if (!this.profile) return;
    const val = this.form.value;
    this.profile.name = val.name;
    this.profile.comment = val.comment;
    this.profile.category = val.category;
    this.profile.profileType = val.profileType;
    this.profile.group = typeof val.group === 'string' ? val.group : (val.group?.id || '');
    this.profile.proxyId = val.proxyId;
    this.profile.tags = (val.tags || []).map((t: any) => typeof t === 'string' ? t : (t?.id || t));

    const profileType = val.profileType;
    if (profileType === ProfileType.SSH_TERMINAL || profileType === ProfileType.SCP_FILE_EXPLORER) this.profile.sshProfile = val.remoteTerminalProfileForm;
    else if (profileType === ProfileType.TELNET_TERMINAL) this.profile.telnetProfile = val.remoteTerminalProfileForm;
    else if (profileType === ProfileType.WIN_RM_TERMINAL) this.profile.winRmProfile = val.remoteTerminalProfileForm;
    else if (profileType === ProfileType.FTP_FILE_EXPLORER) this.profile.ftpProfile = val.ftpProfileForm;
    else if (profileType === ProfileType.SAMBA_FILE_EXPLORER) this.profile.sambaProfile = val.sambaProfileForm;
    else if (profileType === ProfileType.RDP_REMOTE_DESKTOP) this.profile.rdpProfile = val.rdpProfileForm;
    else if (profileType === ProfileType.VNC_REMOTE_DESKTOP) this.profile.vncProfile = val.vncProfileForm;
    else if (val.category === ProfileCategory.CUSTOM) this.profile.customProfile = val.customProfileForm;
  }

  override onSave() {
    if (this.form.valid) {
      this.formToModel();
      this.onProfileSave.emit(this.profile);
      this.onSubmit(); // Reset the dirty form state
    }
  }

  onDelete() {
    this.onProfileDelete.emit(this.profile);
  }

  onClone() {
    this.formToModel();
    this.onProfileClone.emit(this.profile);
  }

  onClose() {
    this.onProfileCancel.emit(this.profile);
  }

  onReload() {
     this.refreshForm(this.profile);
  }

  onConnect() {
    console.log("Form valid:", this.form.valid);
    Object.keys(this.form.controls).forEach(key => {
      const controlErrors = this.form.get(key)?.errors;
      if (controlErrors != null) {
        console.log('Key control: ' + key + ', errors: ', controlErrors);
      }
    });

    if (this.form.valid) {
      this.formToModel();
      this.profileService.onProfileConnect(this.profile);
    }
  }

  onSelectCategory($event: any) {
    const cat = $event.value as ProfileCategory;
    const types = ProfileCategoryTypeMap.get(cat);
    if (types && types.length > 0) {
      this.form.get('profileType')?.setValue(types[0]);
    }
  }

  onSelectType($event: any) {
    // Logic for type selection if needed
  }

  onSelectGroup($event: any) {
    this.groupColor = $event.value?.color || '';
  }

  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value) {
      const existingTag = this.settingStorage.settings.tags.find(t => t.name.toLowerCase() === value.toLowerCase());
      if (existingTag) {
        const currentTags = this.form.get('tags')?.value as Tag[];
        if (!currentTags.find(t => t.id === existingTag.id)) {
            this.form.get('tags')?.setValue([...currentTags, existingTag]);
            this.form.get('tags')?.markAsDirty();
        }
      }
    }
    event.chipInput!.clear();
    this.updateFilteredTag(null);
  }

  removeTag(tag: Tag): void {
    const currentTags = this.form.get('tags')?.value as Tag[];
    const index = currentTags.indexOf(tag);
    if (index >= 0) {
      currentTags.splice(index, 1);
      this.form.get('tags')?.setValue([...currentTags]);
      this.form.get('tags')?.markAsDirty();
    }
  }

  selectTag(event: MatAutocompleteSelectedEvent): void {
    const currentTags = this.form.get('tags')?.value as Tag[];
    if (!currentTags.find(t => t.id === event.option.value.id)) {
        this.form.get('tags')?.setValue([...currentTags, event.option.value]);
        this.form.get('tags')?.markAsDirty();
    }
    this.tagsAutoCompleteInput.nativeElement.value = '';
    this.updateFilteredTag(null);
  }

  updateFilteredTag(event: any): void {
    const value = typeof event === 'string' ? event : event?.target?.value || '';
    const filterValue = value.toLowerCase();
    this.filteredTags = this.settingStorage.settings.tags.filter(tag => tag.name.toLowerCase().includes(filterValue));
  }

  getTypeOptions() {
    return ProfileCategoryTypeMap.get(this.form.get('category')?.value) || [];
  }

  override unordered = (a: any, b: any) => 0;

  override clear(form: any, field: string) {
    form.get(field)?.setValue('');
    form.get(field)?.markAsDirty();
  }
}
