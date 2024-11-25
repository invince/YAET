import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {ProfileCategoryTypeMap, Profile, ProfileCategory} from '../../../domain/Profile';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatInput} from '@angular/material/input';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {SshProfileFormComponent} from '../ssh-profile-form/ssh-profile-form.component';
import {ProfileService} from '../../../services/profile.service';

@Component({
  selector: 'app-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatIcon,
    MatIconButton,
    MatButton,
    MatFormField,
    MatSelect,
    KeyValuePipe,
    MatInput,
    MatOption,
    MatLabel,
    MatSuffix,

    SshProfileFormComponent,
  ],
  templateUrl: './profile-form.component.html',
  styleUrl: './profile-form.component.scss'
})
export class ProfileFormComponent extends MenuComponent implements OnInit {
  @Input() profile!: Profile;
  @Output() onProfileConnect = new EventEmitter<Profile>();
  editProfileForm!: FormGroup;

  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  @Output() dirtyStateChange = new EventEmitter<boolean>();
  private lastDirtyState = false;
  @Output() invalidStateChange = new EventEmitter<boolean>();
  private lastInvalidState = false;


  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
  ) {
    super();


  }

  ngOnInit(): void {
    this.editProfileForm = this.fb.group(
      {
        name:         [this.profile.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        comment:      [this.profile.comment],
        category:     [this.profile.category, Validators.required],
        profileType:  [this.profile.profileType, Validators.required],

      },
      {validators: []}
    );

    this.editProfileForm.valueChanges.subscribe(() => {
      const isDirty = this.editProfileForm.dirty;
      if (isDirty !== this.lastDirtyState) {
        this.lastDirtyState = isDirty;
        this.dirtyStateChange.emit(isDirty);
      }

      const invalid = this.editProfileForm.invalid;
      if (invalid !== this.lastInvalidState) {
        this.lastInvalidState = invalid;
        this.invalidStateChange.emit(invalid);
      }
    });
  }

  onSelectType($event: MatSelectChange) {
    // this.profile.profileType = $event;
  }

  onSelectCategory($event: MatSelectChange) {
    this.editProfileForm.patchValue({
      profileType: null, // Reset dependent fields if needed
    });
  }

  getTypeOptions() {
    const selectedCategory = this.editProfileForm.get('category')?.value; // we work with formGroup, so ngModel to bind profile doesn't work
    return this.CATEGORY_TYPE_MAP.get(selectedCategory);
  }

  override onSave() {
    if (this.editProfileForm.valid) {
      this.formToModel();
      this.profileService.save(this.profile)
        .then(r => this.closeEvent.emit());
    }
  }

  onConnect() {
    if (this.editProfileForm.valid) {
      this.formToModel();
      this.onProfileConnect.emit(this.profile);
      this.closeEvent.emit();
    }
  }

  formToModel() {
    this.profile.name = this.editProfileForm.get('name')?.value;
    this.profile.comment = this.editProfileForm.get('comment')?.value;
    this.profile.category = this.editProfileForm.get('category')?.value;
    this.profile.profileType = this.editProfileForm.get('profileType')?.value;
  }


  onDelete() {

  }
}
