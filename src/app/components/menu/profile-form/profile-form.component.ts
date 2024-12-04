import {
  ChangeDetectorRef,
  Component,
  computed, ElementRef,
  EventEmitter,
  Input,
  model,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {ProfileCategoryTypeMap, Profile, ProfileCategory, ProfileType} from '../../../domain/Profile';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatInput} from '@angular/material/input';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {SshProfileFormComponent} from '../ssh-profile-form/ssh-profile-form.component';
import {ProfileService} from '../../../services/profile.service';
import {IsAChildForm} from '../enhanced-form-mixin';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MasterKeyService} from '../../../services/master-key.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {SettingService} from '../../../services/setting.service';
import {MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {MatAutocompleteModule, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {map, Observable, startWith} from 'rxjs';
import {Tag} from '../../../domain/Tag';

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

    SshProfileFormComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss'
})
export class ProfileFormComponent extends IsAChildForm(MenuComponent) implements OnInit {

  private _profile!: Profile;
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  groupColor: string | undefined = '';

  readonly addOnBlur = true;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  @ViewChild(SshProfileFormComponent) sshChild!: SshProfileFormComponent;
  @ViewChild('tagsAutoCompleteInput') tagsAutoCompleteInput!: ElementRef;

  filteredTags!: Tag[];

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    public masterKeyService: MasterKeyService, // in html
    public settingStorage: SettingStorageService, // in html
    private settingService: SettingService,

    private _snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {
    super();
  }

  get profile(): Profile {
    return this._profile;
  }
  @Input()
  set profile(value: Profile) {
    this._profile = value;
    this.refreshForm(value);
  }

  onInitForm(): FormGroup {
    let form =  this.fb.group(
      {
        name:                   [this._profile.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        comment:                [this._profile.comment],
        category:               [this._profile.category, Validators.required],
        group:                  [],
        tags:                   [[]],
        profileType:            [this._profile.profileType, Validators.required],
        sshProfileForm:         [this._profile.sshTerminalProfile],

      },
      {validators: []}
    );

    return form;
  }

  override afterFormInitialization() {
    this.refreshForm(this.profile);
  }


  onSelectType($event: MatSelectChange) {
    // this.profile.profileType = $event;
  }

  onSelectCategory($event: MatSelectChange) {
    this.form.patchValue({
      profileType: null, // Reset dependent fields if needed
    });
  }

  getTypeOptions() {
    const selectedCategory = this.form.get('category')?.value; // we work with formGroup, so ngModel to bind profile doesn't work
    return this.CATEGORY_TYPE_MAP.get(selectedCategory);
  }

  override onSave() {
    if (this.form.valid) {
      this.formToModel();
      this.profileService.save(this._profile)
        .then(r => {
          // Reset the dirty state
          this.onSubmit();
          this.closeEvent.emit()
        });
    }
  }

  onConnect() {
    if (this.form.valid) {
      this.profileService.onProfileConnect(this.formToModel());
      // Reset the dirty state
      this.onSubmit();
      this.closeEvent.emit();
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

      if (profile?.profileType) {
        switch (profile.profileType) {
          case ProfileType.SSH_TERMINAL:
            this.form.get('sshProfileForm')?.setValue(profile?.sshTerminalProfile)
            break;
        }
      }

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
    this._profile.profileType = this.form.get('profileType')?.value;

    this._profile.sshTerminalProfile = this.sshChild?.formToModel();


    return this._profile;
  }


  onDelete() {
    this.onProfileDelete.emit(this.formToModel());
  }

  onClose() {
    this.onProfileCancel.emit();
  }


  addTag($event: MatChipInputEvent) {
    // const value = ($event.value || '').trim();
    //
    // // Add our fruit
    // if (value) {
    //   this.fruits.update(fruits => [...fruits, value]);
    // }
    //
    // // Clear the input value
    // this.currentFruit.set('');
  }

  onSelectGroup($event: MatSelectChange) {
    this.groupColor = $event.value.color;
  }

  remove(tag: Tag) {
    if (!tag) {
      return;
    }
    const currentTags = this.form.get('tags')?.value || [];
    this.form.get('tags')?.setValue(currentTags.filter((one: Tag) => one.id != tag.id));
    this.form.get('tags')?.updateValueAndValidity();
  }

  selectTag($event: MatAutocompleteSelectedEvent) {
    const selectedTag = $event.option.value;
    console.log('Selected Tag:', selectedTag); // Debug log

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


}
