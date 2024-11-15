import { Component } from '@angular/core';
import {MenuComponent} from '../menu/menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [
    MatIcon,
    MatIconButton
  ],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.css'
})
export class ProfileMenuComponent extends MenuComponent {

}
