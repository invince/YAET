import {Component, EventEmitter, Output} from '@angular/core';
import {FormGroup} from '@angular/forms';

@Component({
    selector: 'app-menu',
    imports: [],
    template: `<p>Abstract Menu</p>`
})
export class MenuComponent {

  @Output() closeEvent = new EventEmitter();

  // @ts-ignore
  unordered = (a: any, b: any)=>0
  close() {
    this.closeEvent.emit();
  }

  onSave() {

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
