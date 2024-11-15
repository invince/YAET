import {Component, EventEmitter, Output} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from "@angular/material/button";

@Component({
  selector: 'app-menu',
  standalone: true,
    imports: [
        MatIcon,
        MatIconButton
    ],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {

  @Output() closeEvent = new EventEmitter();

  closeSettingModal() {
    this.closeEvent.emit();
  }
}
