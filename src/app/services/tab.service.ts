import { Injectable } from '@angular/core';
import {TabInstance} from '../domain/TabInstance';

@Injectable({
  providedIn: 'root'
})
export class TabService {

  private _tabs: TabInstance[] = [];

  public currentTabIndex = 0;

  constructor() { }


  get tabs(): TabInstance[] {
    return this._tabs;
  }

  connected(id: string) {
    this._tabs.filter(one => one.id == id).forEach(one => one.connected = true);
  }

  disconnected(id: string) {
    this._tabs.filter(one => one.id == id).forEach(one => one.connected = false);
  }

  removeById(id: string) {
    this._tabs = this._tabs.filter(one => one.id != id);
  }

  addTab(tabInstance: TabInstance) {
    let allNames = this._tabs.map(one => one.name);
    if (allNames.includes(tabInstance.name)) {
      let index = 1;
            while(allNames.includes(tabInstance.name + '_' + index)) {
        index ++;
      }
      tabInstance.name = tabInstance.name + '_' + index;
    }
    this._tabs.push(tabInstance);
  }

  getSelectedTab() {
    if(this._tabs) {
      return this._tabs[this.currentTabIndex];
    }
    return;
  }
}
