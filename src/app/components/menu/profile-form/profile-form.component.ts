import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {CdkTextareaAutosize} from '@angular/cdk/text-field';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {MatButtonModule} from '@angular/material/button';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {LOCAL_TERMINAL, Profile, ProfileCategory} from '../../../domain/profile/Profile';
import {SecretType} from '../../../domain/Secret';
import {PluginRegistryService} from '../../../plugin/services/plugin-registry.service';
import {Tag} from '../../../domain/Tag';
import {LogService} from '../../../services/log.service';
import {MasterKeyService} from '../../../services/master-key.service';
import {ProfileService} from '../../../services/profile.service';
import {ProxyStorageService} from '../../../services/proxy-storage.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SettingService} from '../../../services/setting.service';
import {IsAChildForm} from '../../EnhancedFormMixin';
import {MenuComponent} from '../menu.component';
import {CustomProfileFormComponent} from './custom-profile-form/custom-profile-form.component';
import {
  RemoteTerminalProfileFormComponent
} from './remote-terminal-profile-form/remote-terminal-profile-form.component';
import {PluginFormHostComponent} from '../../../plugin/components/plugin-form-host.component';
import {ExternalPluginFormComponent} from './external-plugin-form.component';
import {AuthFormComponent} from './auth-form.component';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
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
    PluginFormHostComponent,
    CustomProfileFormComponent,
    ExternalPluginFormComponent,
    AuthFormComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss'
})
export class ProfileFormComponent extends IsAChildForm(MenuComponent) implements OnInit {

  private _profile!: Profile;

  @Input() buttons = ['close', 'delete', 'save', 'connect'];
  @Input() saving = false;
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileClone = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  SecretType = SecretType;
  TELNET_SUPPORTED_SECRETS = [SecretType.PASSWORD_ONLY, SecretType.LOGIN_PASSWORD];
  WINRM_SUPPORTED_SECRETS = [SecretType.LOGIN_PASSWORD];

  groupColor: string | undefined = '';
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  @ViewChild('tagsAutoCompleteInput') tagsAutoCompleteInput!: ElementRef<HTMLInputElement>;
  filteredTags: Tag[] = [];
  tagList: Tag[] = [];

  constructor(
    private log: LogService,
    private fb: FormBuilder,
    private profileService: ProfileService,
    public masterKeyService: MasterKeyService,
    public settingStorage: SettingStorageService,
    public proxyStorage: ProxyStorageService,
    private settingService: SettingService,
    private translate: TranslateService,
    public registry: PluginRegistryService,
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
      profileType: [LOCAL_TERMINAL, Validators.required],
      remoteTerminalProfileForm: [null],
      rdpProfileForm: [null],
      spiceProfileForm: [null],
      vncProfileForm: [null],
      ftpProfileForm: [null],
      sambaProfileForm: [null],
      customProfileForm: [null],
      externalPluginForm: [null],
      externalPluginAuth: [null],
    });
  }

  override afterFormInitialization() {
    if (this._profile) {
      this.refreshForm(this._profile);
    }
  }

  @Input()
  set profile(value: Profile) {
    this._profile = value;
    if (this._profile) {
      this.refreshForm(this._profile);
    }
  }

  get profile(): Profile {
    return this._profile;
  }

  override refreshForm(profile: Profile) {
    if (!profile || !this.form) return;
    this.groupColor = profile.group ? (this.settingStorage.settings.groups.find(g => g.id === profile.group)?.color || '') : '';

    const group = profile.group ? this.settingStorage.settings.groups.find(g => g.id === profile.group) : undefined;
    this.tagList = (profile.tags || []).map(id => this.settingStorage.settings.tags.find(t => t.id === id)).filter((t): t is Tag => !!t);

    const formValue: any = {
      name: profile.name,
      comment: profile.comment,
      category: profile.category,
      profileType: profile.profileType,
      group: group || profile.group,
      tags: this.tagList,
      proxyId: profile.proxyId,
    };

    // Dynamic form field loading via plugin registry
    const meta = this.registry.getFormMetadata(profile.profileType);
    if (meta) {
      formValue[meta.formControlName] = profile.getProfile(meta.profileField) || null;
    } else if (profile.category === ProfileCategory.CUSTOM) {
      formValue.customProfileForm = profile.getProfile('CUSTOM') || null;
    } else if (this.registry.hasExternalPlugin(profile.profileType)) {
      const raw = profile.getProfile(profile.profileType) || {};
      const { authType, login, password, secretId, username, ...rest } = raw;
      // Migrate old format: no authType but has username → treat as login
      const migratedAuth = authType || (username ? 'login' : undefined);
      formValue.externalPluginForm = rest;
      formValue.externalPluginAuth = migratedAuth ? {
        authType: migratedAuth,
        login: login || username || '',
        password: password || '',
        secretId: secretId || '',
      } : null;
    }

    this.form.patchValue(formValue);
    this.form.markAsPristine();
    this.dirtyStateChange.emit(false);
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
    this.profile.tags = this.tagList.map((t: Tag) => t.id);
    this.profile.proxyId = val.proxyId;

    // Dynamic form field saving via plugin registry
    const meta = this.registry.getFormMetadata(val.profileType);
    if (meta) {
      this.profile.setProfile(meta.profileField, val[meta.formControlName]);
    } else if (val.category === ProfileCategory.CUSTOM) {
      this.profile.setProfile('CUSTOM', val.customProfileForm);
    } else if (this.registry.hasExternalPlugin(val.profileType)) {
      const pluginData = { ...(val.externalPluginForm || {}) };
      const authData = val.externalPluginAuth || {};
      // Auth fields override plugin fields
      Object.assign(pluginData, authData);
      this.profile.setProfile(val.profileType, pluginData);
    }
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
    if (this.form.valid) {
      this.formToModel();
      this.profileService.onProfileConnect(this.profile);
    }
  }

  onSelectCategory($event: any) {
    const cat = $event.value as ProfileCategory;
    const types = this.registry.getCategoryTypes(cat);
    if (types && types.length > 0) {
      this.form.get('profileType')?.setValue(types[0].profileType);
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
      if (existingTag && !this.tagList.find(t => t.id === existingTag.id)) {
        this.tagList = [...this.tagList, existingTag];
        this.form.get('tags')?.setValue(this.tagList);
        this.form.get('tags')?.markAsDirty();
        this.dirtyStateChange.emit(true);
      }
    }
    event.chipInput!.clear();
    this.filteredTags = this.settingStorage.settings.tags;
  }

  removeTag(tag: Tag): void {
    const index = this.tagList.indexOf(tag);
    if (index >= 0) {
      this.tagList = [...this.tagList.slice(0, index), ...this.tagList.slice(index + 1)];
      this.form.get('tags')?.setValue(this.tagList);
      this.form.get('tags')?.markAsDirty();
      this.dirtyStateChange.emit(true);
    }
  }

  selectTag(event: MatAutocompleteSelectedEvent): void {
    if (!this.tagList.find(t => t.id === event.option.value.id)) {
      this.tagList = [...this.tagList, event.option.value];
      this.form.get('tags')?.setValue(this.tagList);
      this.form.get('tags')?.markAsDirty();
      this.dirtyStateChange.emit(true);
    }
    this.tagsAutoCompleteInput.nativeElement.value = '';
    this.filteredTags = this.settingStorage.settings.tags;
  }

  updateFilteredTag(event: any): void {
    const value = typeof event === 'string' ? event : event?.target?.value || '';
    const filterValue = value.toLowerCase();
    this.filteredTags = this.settingStorage.settings.tags.filter(tag => tag.name.toLowerCase().includes(filterValue));
  }

  getTypeOptions() {
    const category = this.form.get('category')?.value;
    const baseTypes = this.registry.getCategoryTypes(category).map(t => t.profileType);
    const externalTypes = this.registry.getExternalPluginsByCategory(category)
      .map(p => p.profileType);
    return [...baseTypes, ...externalTypes];
  }

  translateCategory(cat: ProfileCategory): string {
    const keyMap: Record<ProfileCategory, string> = {
      [ProfileCategory.TERMINAL]: 'SETTINGS.TERMINAL',
      [ProfileCategory.REMOTE_DESKTOP]: 'SETTINGS.REMOTE_DESKTOP',
      [ProfileCategory.FILE_EXPLORER]: 'SETTINGS.FILE_EXPLORER',
      [ProfileCategory.CUSTOM]: 'CUSTOM.COMMAND',
    };
    return this.translate.instant(keyMap[cat] || cat);
  }

  translateProfileType(type: any): string {
    const translationKey = this.registry.getProfileTypeTranslationKey(type);
    if (translationKey !== type) return this.translate.instant(translationKey);
    // External plugin: use plugin name from registry
    const ext = this.registry.getExternalPlugin(type);
    return ext?.name || type;
  }

  override unordered = (a: any, b: any) => 0;

  override clear(form: any, field: string) {
    form.get(field)?.setValue('');
    form.get(field)?.markAsDirty();
  }

  isExternalTerminalPlugin(): boolean {
    const profileType = this.form?.get('profileType')?.value;
    if (!this.registry.hasExternalPlugin(profileType)) return false;
    // Only terminal-type external plugins use the shared remote terminal form
    return profileType?.includes('TERMINAL') ?? false;
  }

  getExternalPluginFormElement(): string {
    const profileType = this.form?.get('profileType')?.value;
    const ext = this.registry.getExternalPlugin(profileType);
    return ext?.profileFormElement || '';
  }

  getExternalPluginAuthTypes(): string[] {
    const profileType = this.form?.get('profileType')?.value;
    const ext = this.registry.getExternalPlugin(profileType);
    return ext?.supportedAuthTypes || ['N/A', 'login', 'secret'];
  }

  getExternalPluginSecretTypes(): SecretType[] {
    const profileType = this.form?.get('profileType')?.value;
    const ext = this.registry.getExternalPlugin(profileType);
    return ext?.secretTypes as SecretType[] || [SecretType.LOGIN_PASSWORD, SecretType.PASSWORD_ONLY];
  }

  getExternalPluginHideLogin(): boolean {
    const profileType = this.form?.get('profileType')?.value;
    // SPICE uses ticket auth — only password, no login/username
    return profileType === 'SPICE_REMOTE_DESKTOP';
  }

  hasExternalPluginAuth(): boolean {
    const profileType = this.form?.get('profileType')?.value;
    const ext = this.registry.getExternalPlugin(profileType);
    return ext?.supportedAuthTypes?.length ? ext.supportedAuthTypes.length > 0 : false;
  }

  getExternalPluginType(): string {
    const profileType = this.form?.get('profileType')?.value;
    if (profileType?.includes('TELNET')) return 'telnet';
    if (profileType?.includes('WINRM')) return 'winrm';
    return '';
  }

  getPluginFormComponent(): any {
    const profileType = this.form?.get('profileType')?.value;
    return this.registry.getProfileFormComponent(profileType);
  }

  getPluginFormControl(): FormControl {
    const name = this.getPluginFormControlName();
    return this.form.get(name) as FormControl;
  }

  getPluginFormControlName(): string {
    const profileType = this.form?.get('profileType')?.value;
    const meta = this.registry.getFormMetadata(profileType);
    return meta?.formControlName || '';
  }
}
