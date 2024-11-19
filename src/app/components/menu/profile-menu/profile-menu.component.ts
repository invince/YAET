import {Component, Input, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {ProfileCategoryTypeMap, Profile, ProfileCategory} from '../../../domain/Profile';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {MatInput} from '@angular/material/input';
import {FormsModule} from '@angular/forms';
import {SshProfileMenuComponent} from '../ssh-profile-menu/ssh-profile-menu.component';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,

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

    SshProfileMenuComponent,
  ],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.css'
})
export class ProfileMenuComponent extends MenuComponent implements OnInit {
  @Input() profile!: Profile;

  CATEGORY_OPTIONS = ProfileCategory;
  CATEGORY_TYPE_MAP = ProfileCategoryTypeMap;

  constructor() {
    super();
  }
  ngOnInit(): void {
    if (!this.profile) {
      this.profile = new Profile();
    }
  }

  onSelectType($event: any) {
    this.profile.profileType = $event;
  }
}
