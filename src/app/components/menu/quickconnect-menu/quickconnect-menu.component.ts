import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MenuComponent} from '../menu.component';
import {ProfileFormComponent} from "../profile-form/profile-form.component";
import {Profile, Profiles} from '../../../domain/profile/Profile';
import {ProfileService} from '../../../services/profile.service';
import {NotificationService} from '../../../services/notification.service';

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
      ProfileFormComponent,

    ],
  templateUrl: './quickconnect-menu.component.html',
  styleUrl: './quickconnect-menu.component.css'
})
export class QuickconnectMenuComponent extends MenuComponent  implements OnInit {

  profile: Profile = new Profile();
  profilesCopy!: Profiles;
  constructor(
    private profileService: ProfileService,
    private notification: NotificationService,
  ) {
    super();
  }

  ngOnInit(): void {
    this.profilesCopy = this.profileService.profilesCopy;
  }

  async onSaveOne($event: Profile) {
    this.profilesCopy.update($event);
    await this.profileService.save(this.profilesCopy);
    this.notification.info(`New profile ${$event.name} saved`);
    this.close();
    // this.refreshSecretForm();
  }

  onCancel($event: Profile) {
    this.close(); // no need deleteLocal
  }
}
