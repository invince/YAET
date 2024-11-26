import {Component, OnInit} from '@angular/core';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {MatInput} from '@angular/material/input';
import {MenuComponent} from '../menu.component';
import {ProfileFormComponent} from "../profile-form/profile-form.component";
import {Profile} from '../../../domain/Profile';
import {ProfileService} from '../../../services/profile.service';

@Component({
  selector: 'app-quickconnect-menu',
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
        ProfileFormComponent,

    ],
  templateUrl: './quickconnect-menu.component.html',
  styleUrl: './quickconnect-menu.component.css'
})
export class QuickconnectMenuComponent extends MenuComponent {

  constructor(private profileService: ProfileService) {
    super();
  }
  createNewProfile(): Profile {
    return new Profile();
  }

  async onSaveOne($event: Profile) {
    this.profileService.profiles.push($event);
    await this.profileService.saveAll();
    this.close();
    // this.refreshSecretForm();
  }

  onCancel($event: Profile) {
    this.close(); // no need deleteLocal
  }
}
