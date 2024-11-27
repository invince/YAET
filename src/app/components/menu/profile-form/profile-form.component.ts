import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {ProfileCategoryTypeMap, Profile, ProfileCategory, ProfileType} from '../../../domain/Profile';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect, MatSelectChange} from '@angular/material/select';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatInput} from '@angular/material/input';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {SshProfileFormComponent} from '../ssh-profile-form/ssh-profile-form.component';
import {ProfileService} from '../../../services/profile.service';
import {IsAChildForm} from '../enhanced-form-mixin';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MasterKeyService} from '../../../services/master-key.service';

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
export class ProfileFormComponent extends IsAChildForm(MenuComponent) implements OnInit {

  private _profile!: Profile;
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  @ViewChild(SshProfileFormComponent) sshChild!: SshProfileFormComponent;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    public masterKeyService: MasterKeyService,

    private _snackBar: MatSnackBar,
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
    return  this.fb.group(
      {
        name:         [this._profile.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        comment:      [this._profile.comment],
        category:     [this._profile.category, Validators.required],
        profileType:  [this._profile.profileType, Validators.required],
        sshProfileForm:  [this._profile.sshTerminalProfile],

      },
      {validators: []}
    );
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
      this.form.get('category')?.setValue(profile?.category);
      this.form.get('profileType')?.setValue(profile?.profileType);

      if (profile?.profileType) {
        switch (profile.profileType) {
          case ProfileType.SSH_TERMINAL:
            this.form.get('sshProfileForm')?.setValue(profile?.sshTerminalProfile)
            break;
        }
      }
    }
  }


  formToModel(): Profile {
    this._profile.name = this.form.get('name')?.value;
    this._profile.comment = this.form.get('comment')?.value;
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
}
