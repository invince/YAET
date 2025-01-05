import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {SettingService} from '../../../../services/setting.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {ProfileService} from '../../../../services/profile.service';
import {MySettings} from '../../../../domain/setting/MySettings';
import {MatChipEditedEvent, MatChipsModule} from '@angular/material/chips';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatTreeModule, MatTreeNestedDataSource} from '@angular/material/tree';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {GroupNode} from '../../../../domain/GroupNode';
import {NestedTreeControl} from '@angular/cdk/tree';
import {NotificationService} from '../../../../services/notification.service';

@Component({
  selector: 'app-groups-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatTreeModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatChipsModule,
    MatInput
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './groups-form.component.html',
  styleUrl: './groups-form.component.scss'
})
export class GroupsFormComponent implements OnInit{

  dataSource = new MatTreeNestedDataSource<GroupNode>();
  newGroupName: string = '';
  treeControl = new NestedTreeControl<GroupNode>(node => node.children);
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

    this.dataSource.data = this.createGroupDataSource();
  }

  hasChild(_: number, node: GroupNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  createGroupDataSource(): GroupNode[] {
    return GroupNode.map2DataSource(
      this.settingStorage.settings.groups,
      this.profileService.profiles.profiles,
      true,
      false,
      (group, node) => {
        node.editable = true;
        return node;
      }
    );
  }

  onAddGroup($event: any) {
    if (!this.newGroupName) {
      return;
    }
    let newName = this.newGroupName.trim();
    if (newName.length > 0) {
      if (!this.settingService.existGroup(this.newGroupName)){
        this.settingService.addGroup(this.newGroupName);

        this.newGroupName = '';

        this.dataSource.data = this.createGroupDataSource();

      } else {
        this.notification.error(`Empty name is not allowed for a group, your change weill be aborted`);
      }
    }
  }

  async update(node: GroupNode, event: MatChipEditedEvent) {
    const updateName = event.value.trim();
    if (!node.group) {
      this.notification.error('Invalid group, your change will be abort');
      node.name = node.oldName;
      return
    }

    // Remove tag if it no longer has a name
    if (!updateName) {
      await this.remove(node);
      this.dataSource.data = this.createGroupDataSource();
      return;
    }
    if (!this.settingService.existGroup(updateName, node.id)){
      this.settingService.updateGroup(node.group, updateName);
      this.dataSource.data = this.createGroupDataSource();
    } else {
      this.notification.error(`Already have this ${updateName}, your change weill be aborted`);
      node.name = node.oldName;
    }
  }


  async remove(groupNode: GroupNode) {
    if (groupNode.group) {
      await this.settingService.removeGroup(groupNode.group);
    }
    this.dataSource.data = this.createGroupDataSource();
  }

  openColorPicker(index: string): void {
    const picker = document.getElementById('group-color-picker-' + index) as HTMLElement;
    picker.click();
  }

  updateColor(node: GroupNode, event: any): void {
    const color = event.target.value.trim();
    if (color && node.group) {
      this.settingService.updateGroupColor(node.group, color);
      this.dataSource.data = this.createGroupDataSource();
    }
  }
}


