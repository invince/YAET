import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {SettingService} from '../../../services/setting.service';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {ProfileService} from '../../../services/profile.service';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MySettings} from '../../../domain/MySettings';
import {MatChipEditedEvent, MatChipInputEvent, MatChipsModule} from '@angular/material/chips';
import {Tag} from '../../../domain/Tag';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatTreeModule, MatTreeNestedDataSource} from '@angular/material/tree';
import {Group} from '../../../domain/Group';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';

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
    if (!this.settingStorage.settings.groups) {
      this.settingStorage.settings.groups = [];
    }

    this.dataSource.data = this.createGroupDataSource();
  }

  hasChild(_: number, node: GroupNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  createGroupDataSource(): GroupNode[] {
    let result: GroupNode[] = [];
    let groups = this.settingStorage.settings.groups;
    let profiles = this.profileService.profiles;

    if (groups) {
      for (let oneGroup of groups) {
        let node = new GroupNode();
        node.name = oneGroup.name;
        node.oldName = node.name;
        node.id = oneGroup.id;
        node.group = oneGroup;
        node.color = oneGroup.color;
        node.editable = true;
        let filteredProfiles =  profiles.filter(one => one.group == oneGroup.id);
        if (filteredProfiles) {
          node.children = [];
          for (let oneProfile of filteredProfiles) {
            let childNode = new GroupNode();
            childNode.name = oneProfile.name;
            childNode.oldName = oneProfile.name;
            childNode.id = oneProfile.id;
            node.children.push(childNode);
          }
        }

        result.push(node);
      }
    }
    return result;
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
    const value = event.value.trim();
    if (!node.group) {
      this._snackBar.open('Invalid group, your change will be abort', 'Ok', {
        duration: 3000
      });
      node.name = node.oldName;
      return
    }

    // Remove tag if it no longer has a name
    if (!value) {
      await this.remove(node);
      this.dataSource.data = this.createGroupDataSource();
      return;
    }
    if (!this.settingService.existGroup(this.newGroupName, node.id)){
      this.settingService.updateGroup(node.group, this.newGroupName);
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

export class GroupNode {
  name? : string;

  oldName? : string;

  id? : string;

  editable: boolean = false;

  color: string = '';

  group?: Group;

  children?: GroupNode[];

}

