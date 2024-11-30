import {ChangeDetectionStrategy, Component} from '@angular/core';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
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
import { MatTreeModule} from '@angular/material/tree';
import {Group} from '../../../domain/Group';
import {Profile} from '../../../domain/Profile';
import {MatButtonModule} from '@angular/material/button';

@Component({
  selector: 'app-groups-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatTreeModule, MatButtonModule, MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './groups-form.component.html',
  styleUrl: './groups-form.component.scss'
})
export class GroupsFormComponent {

  childrenAccessor = (node: GroupNode) => node.children ?? [];
  dataSource: GroupNode[] = [];
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

    this.dataSource = this.createGroupDataSource();
  }

  add(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      if (!this.settingService.existTag(value)) {
        this.settingService.addGroup(value);
      } else {
        this._snackBar.open('Cannot add duplicate Group', 'Ok', {
          duration: 3000
        });
      }
    }

    // Clear the input value
    event.chipInput!.clear();
  }

  async remove(tag: Tag) {
    await this.settingService.removeTag(tag);
  }

  async update(tag: Tag, event: MatChipEditedEvent) {
    const value = event.value.trim();

    // Remove tag if it no longer has a name
    if (!value) {
      await this.remove(tag);
      return;
    }
    if (!this.settingService.existTag(value, tag.id)) {
      this.settingService.updateTag(tag, value);
    } else {
      this._snackBar.open('Already have this value', 'Ok', {
        duration: 3000
      });
    }
  }

  openColorPicker(index: number): void {
    const picker = document.getElementById('tag-color-picker-' + index) as HTMLElement;
    picker.click();
  }

  updateColor(tag: Tag, event: any): void {
    const color = event.target.value.trim();
    if (color) {
      this.settingService.updateTagColor(tag, color);
    }
  }

  hasChild(_: number, node: GroupNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  createGroupDataSource(): GroupNode[] {
    let result: GroupNode[] = [];
    // let groups = this.settingStorage.settings.groups;
    // let profiles = this.profileService.profiles;

    let groups = [new Group("g0"), new Group("g1"), new Group("g2")];


    let profiles = [new Profile(), new Profile(), new Profile(), new Profile(), new Profile()];
    profiles[0].name = "p0";
    profiles[0].group = groups[0].id;
    profiles[1].name = "p1";
    profiles[1].group = groups[0].id;

    profiles[2].name = "p2";
    profiles[2].group = groups[1].id;

    profiles[3].name = "p3";
    profiles[3].group = groups[0].id;

    if (groups) {
      for (let oneGroup of groups) {
        let node = new GroupNode();
        node.name = oneGroup.name;
        node.id = oneGroup.id;
        let filteredProfiles =  profiles.filter(one => one.group == oneGroup.id);
        if (filteredProfiles) {
          node.children = [];
          for (let oneProfile of filteredProfiles) {
            let childNode = new GroupNode();
            childNode.name = oneProfile.name;
            childNode.id = oneProfile.id;
            node.children.push(childNode);
          }
        }

        result.push(node);
      }
    }
    return result;
  }


  addGroup(): void {
    // const newGroup: GroupNode = { id: Date.now(), name: 'New Group', children: [] };
    // this.data.push(newGroup);
    // this.dataSource.data = this.data;
  }

}

export class GroupNode {
  name? : string;

  id? : string;

  children?: GroupNode[];

}

