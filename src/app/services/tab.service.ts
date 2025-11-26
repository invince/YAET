import { Injectable } from '@angular/core';
import { TabInstance } from '../domain/TabInstance';

@Injectable({
  providedIn: 'root'
})
export class TabService {

  private _tabs: TabInstance[] = [];

  public currentTabIndex = 0; // Deprecated, use paneTabIndices
  public paneTabIndices: number[] = [0, 0];
  public splitMode: boolean = false;
  public activePane: number = 0;

  constructor() { }


  get tabs(): TabInstance[] {
    return this._tabs;
  }

  getTabsForPane(paneId: number): TabInstance[] {
    return this._tabs.filter(t => t.paneId === paneId);
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
      while (allNames.includes(tabInstance.name + '_' + index)) {
        index++;
      }
      tabInstance.name = tabInstance.name + '_' + index;
    }

    // Assign to active pane
    tabInstance.paneId = this.activePane;

    this._tabs.push(tabInstance);

    // Switch to the new tab in the active pane
    setTimeout(() => {
      const paneTabs = this.getTabsForPane(this.activePane);
      this.paneTabIndices[this.activePane] = paneTabs.length - 1;
    });
  }

  getSelectedTab() {
    // Return selected tab of active pane
    const paneTabs = this.getTabsForPane(this.activePane);
    if (paneTabs && paneTabs.length > 0) {
      return paneTabs[this.paneTabIndices[this.activePane]];
    }
    return undefined;
  }

  removeTab(index: number, paneId: number = 0) {
    const paneTabs = this.getTabsForPane(paneId);
    if (index >= 0 && index < paneTabs.length) {
      const tabToRemove = paneTabs[index];
      this._tabs = this._tabs.filter(t => t !== tabToRemove);

      // Adjust index if needed
      if (index <= this.paneTabIndices[paneId] && this.paneTabIndices[paneId] != 0) {
        this.paneTabIndices[paneId]--;
      }
    }
  }

  toggleSplit() {
    this.splitMode = !this.splitMode;
    if (!this.splitMode) {
      // Merge all tabs to pane 0
      this._tabs.forEach(t => t.paneId = 0);
      this.activePane = 0;
    }
  }

  setActivePane(paneId: number) {
    this.activePane = paneId;
  }

  moveTabToPane(tab: TabInstance, targetPaneId: number) {
    const sourcePaneId = tab.paneId;

    // Don't do anything if moving to same pane
    if (sourcePaneId === targetPaneId) {
      return;
    }

    // Get current index in source pane
    const sourcePaneTabs = this.getTabsForPane(sourcePaneId);
    const sourceIndex = sourcePaneTabs.indexOf(tab);

    // Update tab's pane
    tab.paneId = targetPaneId;

    // Adjust source pane index if needed
    if (sourceIndex !== -1 && sourceIndex <= this.paneTabIndices[sourcePaneId] && this.paneTabIndices[sourcePaneId] > 0) {
      this.paneTabIndices[sourcePaneId]--;
    }

    // Set target pane to show the moved tab
    setTimeout(() => {
      const targetPaneTabs = this.getTabsForPane(targetPaneId);
      this.paneTabIndices[targetPaneId] = targetPaneTabs.length - 1;
      this.activePane = targetPaneId;
    });
  }
}
