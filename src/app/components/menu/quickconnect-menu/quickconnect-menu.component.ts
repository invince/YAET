import {Component} from '@angular/core';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
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

      MatFormFieldModule,
      MatButtonModule,
      MatSelectModule,

      MatIcon,
      KeyValuePipe,
      MatInput,
      ProfileFormComponent,

    ],
  templateUrl: './quickconnect-menu.component.html',
  styleUrl: './quickconnect-menu.component.css'
})
export class QuickconnectMenuComponent extends MenuComponent {

  profile: Profile = new Profile();
  constructor(private profileService: ProfileService) {
    super();
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
