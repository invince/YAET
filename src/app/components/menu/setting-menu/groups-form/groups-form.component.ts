import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {SettingService} from '../../../../services/setting.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {ProfileService} from '../../../../services/profile.service';
import {MySettings} from '../../../../domain/setting/MySettings';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {GroupNode} from '../../../../domain/GroupNode';
import {NotificationService} from '../../../../services/notification.service';
import {Group} from '../../../../domain/Group';

@Component({
    selector: 'app-groups-form',
    imports: [
        FormsModule,
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInput,
        MatTooltipModule
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './groups-form.component.html',
    styleUrl: './groups-form.component.scss'
})
export class GroupsFormComponent implements OnInit{

  newGroupName: string = '';
  editingGroupId: string | null = null;
  private savedEditName = '';

  constructor(
    private settingService: SettingService,
    public settingStorage: SettingStorageService,
    public profileService: ProfileService,
    private notification: NotificationService,
  ) {
  }

  ngOnInit() {
    if (!this.settingStorage.settings) {
      this.settingStorage.settings = new MySettings();
    }
    if (!this.settingStorage.settings.groups) {
      this.settingStorage.settings.groups = [];
    }
  }

  get groups(): Group[] {
    return this.settingStorage.settings.groups || [];
  }

  get groupNodes(): GroupNode[] {
    return GroupNode.map2DataSource(
      this.settingStorage.settings.groups,
      this.profileService?.profilesCopy?.profiles,
      true, false,
      (group, node) => { node.editable = true; return node; }
    );
  }

  refresh() {
    // Trigger change detection by reassigning (immutable pattern)
    this.groupNodes;
  }

  getProfileCount(node: GroupNode): number {
    if (!this.profileService?.profilesCopy?.profiles || !node.id) return 0;
    return this.profileService.profilesCopy.profiles.filter(p => p.group === node.id).length;
  }

  onAddGroup($event: any) {
    if (!this.newGroupName || !this.newGroupName.trim()) {
      return;
    }
    const name = this.newGroupName.trim();
    if (!this.settingService.existGroup(name)) {
      this.settingService.addGroup(name);
      this.newGroupName = '';
      this.refresh();
    } else {
      this.notification.error(`Group "${name}" already exists`);
    }
  }

  startEdit(node: GroupNode) {
    this.editingGroupId = node.id || null;
    this.savedEditName = node.name;
  }

  cancelEdit() {
    this.editingGroupId = null;
  }

  saveEdit(node: GroupNode, newName: string) {
    this.editingGroupId = null;
    const updateName = newName?.trim();
    if (!updateName || !node.group) {
      if (!updateName && node.group) {
        this.remove(node);
      }
      return;
    }
    if (!this.settingService.existGroup(updateName, node.id)) {
      this.settingService.updateGroup(node.group, updateName);
      this.refresh();
    } else {
      this.notification.error(`Group "${updateName}" already exists`);
    }
  }

  async remove(groupNode: GroupNode) {
    if (groupNode.group) {
      await this.settingService.removeGroup(groupNode.group);
    }
    this.refresh();
  }

  updateColor(node: GroupNode, event: any): void {
    const color = event.target.value.trim();
    if (color && node.group) {
      this.settingService.updateGroupColor(node.group, color);
      this.refresh();
    }
  }
}
