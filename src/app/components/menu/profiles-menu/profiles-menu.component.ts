import {Component, OnDestroy, OnInit} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {MatSidenavModule} from '@angular/material/sidenav';
import {MenuComponent} from '../menu.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ProfileService} from '../../../services/profile.service';
import {Profile} from '../../../domain/Profile';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatSelect} from '@angular/material/select';
import {ProfileFormComponent} from '../profile-form/profile-form.component';
import {HasChildForm} from '../enhanced-form-mixin';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {ModalControllerService} from '../../../services/modal-controller.service';
import {Subscription} from 'rxjs';
import {Secret} from '../../../domain/Secret';
import {group} from '@angular/animations';
import {SettingService} from '../../../services/setting.service';
import {FilterKeywordPipe} from '../../../pipes/filter-keyword.pipe';

@Component({
  selector: 'app-profiles-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatSidenavModule,
    MatButtonModule,

    MatOption,
    MatInput,
    MatIcon,

    MatSelect,
    ProfileFormComponent,
    FilterKeywordPipe,
  ],
  templateUrl: './profiles-menu.component.html',
  styleUrl: './profiles-menu.component.css'
})
export class ProfilesMenuComponent extends HasChildForm(MenuComponent) implements OnInit, OnDestroy {

  selectedIndex!: number;
  selectedProfile!: Profile;

  subscription!: Subscription;
  filter!: string;

  constructor(
    public profileService: ProfileService,
    public settingStorage: SettingStorageService,
    private settingService: SettingService,
    private _snackBar: MatSnackBar,

    private modalControl: ModalControllerService,
  ) {
    super();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.subscription = this.modalControl.modalCloseEvent.subscribe(one => {
      if (one && one.includes('favorite')) {
        this.profileService.deleteNotSavedNewProfileInLocal();
        this.modalControl.closeModal();
      }
    });
  }

  addTab() {
    this.profileService.profiles.push(new Profile());
    this.selectedIndex = this.profileService.profiles.length - 1; // Focus on the newly added tab
    // this.refreshSecretForm();
  }

  onTabChange(i: number, profile: Profile) {
    if (this.selectedIndex == i) {
      this.selectedProfile = profile;
      return;
    }
    if (this.selectedIndex &&
      (this.lastChildFormInvalidState || this.lastChildFormDirtyState)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedProfile = profile;
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
    let LIMIT = this.settingStorage.settings?.ui?.profileLabelLength || 10;

    let label = 'New';
    if (profile && profile.name) {
      label = profile.name;
      if (profile.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (index == this.selectedIndex && this.lastChildFormDirtyState) {
      label += '*'
    }
    return label;
  }

  hasNewProfile() {
    let currentProfile = this.profileService.profiles[this.selectedIndex];
    return currentProfile?.isNew;
  }


  keywordsProviders: ((profile: Profile) => string | string[])[] = [
    (profile: Profile) => profile.name,
    (profile: Profile) => profile.comment,
    (profile: Profile) => profile.category,
    (profile: Profile) => profile.profileType,
    (profile: Profile) => {
        if (profile.group) {
          let group = this.settingService.findGroupById(profile.id);
          if (group) {
            return [group.name];
          }
        }
        return [];
    },
    (profile: Profile) => {
      if (profile.tags) {
        return profile.tags.map(one => this.settingService.findTagById(one))
          .filter(one => one !== undefined)
          .map(one => one.name);
      }
      return [];
    },
  ];

}
