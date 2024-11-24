import {Component, EventEmitter, Output} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from "@angular/material/button";
import {FormGroup} from '@angular/forms';

@Component({
  selector: 'app-menu',
  standalone: true,
    imports: [
        MatIcon,
        MatIconButton
    ],
  template: `<p>Abstract Menu</p>`,
})
export class MenuComponent {

  @Output() closeEvent = new EventEmitter();

  // @ts-ignore
  unordered = (a,b)=>0
  close() {
    this.closeEvent.emit();
  }

  save() {

  }

  clear(group: FormGroup, fieldName: string) {
    if (group) {
      let field = group.get(fieldName);
      if (field) {
        field.setValue(null);
      }
    }
  }
}
