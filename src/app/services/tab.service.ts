import { Injectable } from '@angular/core';
import {TabInstance} from '../domain/TabInstance';

@Injectable({
  providedIn: 'root'
})
export class TabService {

  private _tabs: TabInstance[] = [];

  private _currentTabIndex = 0;
  constructor() { }


  set currentTabIndex(value: number) {
    this._currentTabIndex = value;
  }

  get tabs(): TabInstance[] {
    return this._tabs;
  }

  get currentTabIndex(): number {
    return this._currentTabIndex;
  }


}
