import {Component, EventEmitter, Input, Output} from '@angular/core';
import {SSHTerminalProfile} from '../../../domain/SSHTerminalProfile';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-ssh-profile-menu',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,

    MatLabel,
    MatInput,
    MatFormField,
    MatIcon,
    MatSuffix
  ],
  templateUrl: './ssh-profile-menu.component.html',
  styleUrl: './ssh-profile-menu.component.css'
})
export class SshProfileMenuComponent {

    @Input() ssh!: SSHTerminalProfile;
    @Output() sshChange = new EventEmitter<SSHTerminalProfile>();



}
