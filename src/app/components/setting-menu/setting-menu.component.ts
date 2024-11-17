import { Component } from '@angular/core';
import {MenuComponent} from '../menu/menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';

@Component({
  selector: 'app-setting-menu',
  standalone: true,
  imports: [
    MatIcon,
    MatIconButton
  ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent{

}
