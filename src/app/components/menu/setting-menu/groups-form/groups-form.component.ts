import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {SettingService} from '../../../../services/setting.service';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {ProfileService} from '../../../../services/profile.service';
import {MatSnackBar} from '@angular/material/snack-bar';
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

  childrenAccessor = (node: GroupNode) => node.children ?? [];
  // dataSource: GroupNode[] = [];
  dataSource = new MatTreeNestedDataSource<GroupNode>();
  newGroupName: string = '';
  treeControl = new NestedTreeControl<GroupNode>(node => node.children);
  constructor(
    private settingService: SettingService,
    public settingStorage: SettingStorageService,

    public profileService: ProfileService,

    private _snackBar: MatSnackBar,
  ) {
  }

  ngOnInit() {
    if (!this.settingStorage.settings) {
      this.settingStorage.settings = new MySettings();
    }
    if (!this.settingStorage.settings.general.groups) {
      this.settingStorage.settings.general.groups = [];
    }

    this.dataSource.data = this.createGroupDataSource();
  }

  hasChild(_: number, node: GroupNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  createGroupDataSource(): GroupNode[] {
    return GroupNode.map2DataSource(
      this.settingStorage.settings.general.groups,
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
        this._snackBar.open('Already have this value', 'Ok', {
          duration: 3000
        });
      }
    }
  }

  async update(node: GroupNode, event: MatChipEditedEvent) {
    const updateName = event.value.trim();
    if (!node.group) {
      this._snackBar.open('Invalid group, your change will be abort', 'Ok', {
        duration: 3000
      });
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
      this._snackBar.open('Already have this value, your change weill be aborted', 'Ok', {
        duration: 3000
      });
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


