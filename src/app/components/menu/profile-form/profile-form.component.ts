import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
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
import {HasChildForm, IsAChildForm} from '../enhanced-form-mixin';
import {MatSnackBar} from '@angular/material/snack-bar';
import {SecretService} from '../../../services/secret.service';
import {MasterKeyComponent} from '../master-key/master-key.component';
import {MatDialog} from '@angular/material/dialog';

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
export class ProfileFormComponent extends HasChildForm(IsAChildForm(MenuComponent)) implements OnInit {

  private _profile!: Profile;
  @Output() onProfileConnect = new EventEmitter<Profile>();
  @Output() onProfileSave = new EventEmitter<Profile>();
  @Output() onProfileDelete = new EventEmitter<Profile>();
  @Output() onProfileCancel = new EventEmitter<Profile>();

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  @ViewChild(SshProfileFormComponent) sshChild!: SshProfileFormComponent;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private secretService: SecretService,

    public dialog: MatDialog,
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
    this.refreshForm();
  }

  onInitForm(): FormGroup {
    return  this.fb.group(
      {
        name:         [this._profile.name, [Validators.required, Validators.minLength(3)]], // we shall avoid use ngModel and formControl at same time
        comment:      [this._profile.comment],
        category:     [this._profile.category, Validators.required],
        profileType:  [this._profile.profileType, Validators.required],

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
    if (this.form.valid && !this.lastChildFormInvalidState) {
      this.formToModel();
      if (this.containsPassword(this.profile) && !this.secretService.hasMasterKey) {
        const snackBarRef = this._snackBar.open('You have password in this profile, but you haven\'t defined Master Key.', 'Set it', {
          duration: 3000
        });
        snackBarRef.onAction().subscribe(() => {
          this.openMasterKeyModal();
        });
      } else {
        this.profileService.save(this._profile)
          .then(r => {
            // Reset the dirty state
            this.onSubmit();
            this.closeEvent.emit()
          });
      }
    }
  }

  public override onChildFormDirtyStateChange($event: any) {
    super.onChildFormDirtyStateChange($event);
    if (!$event) {
      this.form.markAsTouched();
      this.dirtyStateChange.emit(true);
    }
  }

  onConnect() {
    if (this.form.valid) {
      this.formToModel();
      this.onProfileConnect.emit(this._profile);
      // Reset the dirty state
      this.onSubmit();
      this.closeEvent.emit();
    }
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


  private refreshForm() {
    if (this.form) {
      this.form.reset();

      let profile = this.profile;
      this.form.get('name')?.setValue(profile.name);
      this.form.get('comment')?.setValue(profile.comment);
      this.form.get('category')?.setValue(profile.category);
      this.form.get('profileType')?.setValue(profile.profileType);
    }
  }


  formToModel() {
    this._profile.name = this.form.get('name')?.value;
    this._profile.comment = this.form.get('comment')?.value;
    this._profile.category = this.form.get('category')?.value;
    this._profile.profileType = this.form.get('profileType')?.value;

    this._profile.sshTerminalProfile = this.sshChild?.formToModel();


  }


  onDelete() {

  }

  private containsPassword(profile: Profile): boolean{
    if (profile) {
      if (profile.sshTerminalProfile && profile.sshTerminalProfile.password ) {
         return true;
      }
    }
    return false;
  }
}
