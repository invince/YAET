import { Component } from '@angular/core';

@Component({
  selector: 'app-tab-container',
  templateUrl: './tab-container.component.html',
  styleUrls: ['./tab-container.component.css']
})
export class TabContainerComponent {
  tabs = [0];

  addTab() {
    this.tabs.push(this.tabs.length);
  }
}
