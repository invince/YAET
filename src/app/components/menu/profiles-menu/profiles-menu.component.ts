import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {MenuComponent} from '../menu.component';
import {SecretService} from '../../../services/secret.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Secret} from '../../../domain/Secret';
import {ProfileService} from '../../../services/profile.service';
import {Profile} from '../../../domain/Profile';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatError, MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatButton, MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {MatSelect} from '@angular/material/select';
import {ProfileFormComponent} from '../profile-form/profile-form.component';

@Component({
  selector: 'app-profiles-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormField,
    MatOption,
    MatInput,
    MatSuffix,
    MatIcon,
    MatIconButton,
    MatLabel,

    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatButton,
    MatMiniFabButton,
    MatError,
    MatSelect,
    ProfileFormComponent,
  ],
  templateUrl: './profiles-menu.component.html',
  styleUrl: './profiles-menu.component.css'
})
export class ProfilesMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  selectedIndex!: number;
  lastFormDirtyState = false;
  lastFormInvalidState = false;
  constructor(

    public profileService: ProfileService,
    private _snackBar: MatSnackBar,
  ) {
    super();
  }

  ngOnDestroy(): void {
  }

  ngOnInit(): void {
  }

  addTab() {
    this.profileService.profiles.push(new Profile());
    this.selectedIndex = this.profileService.profiles.length - 1; // Focus on the newly added tab
    // this.refreshSecretForm();
  }

  onTabChange(i: number) {
    if (this.selectedIndex == i) {
      return;
    }
    if (this.selectedIndex &&
      (this.lastFormInvalidState || this.lastFormDirtyState)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedIndex = i;
    // this.refreshSecretForm();
  }


  async onDelete($event: Profile) {
    this.profileService.deleteLocal($event);
    if (!$event.isNew) {
      await this.profileService.saveAll();
    }
    this.selectedIndex = Math.min(this.selectedIndex, this.profileService.profiles.length - 1);
    // this.refreshSecretForm();
  }

  async onSaveOne($event: Profile) {
    this.profileService.profiles[this.selectedIndex] = $event;
    await this.profileService.saveAll();
    // this.refreshSecretForm();
  }

  onCancel($event: Profile) {
    if ($event) {
      if ($event.isNew) {
        this.profileService.deleteLocal($event);
      }
    }
    this.close();
  }

  profileTabLabel(profile: Profile, index: number) {
    let label = 'New';
    if (profile && profile.name) {
      label = profile.name;
      if (profile.name.length > 6) {
        label = label.slice(0, 6) + '...';
      }
    }
    if (index == this.selectedIndex && this.lastFormDirtyState) {
      label += '*'
    }
    return label;
  }

  hasNewProfile() {
    let currentProfile = this.profileService.profiles[this.selectedIndex];
    return currentProfile?.isNew;
  }
}
