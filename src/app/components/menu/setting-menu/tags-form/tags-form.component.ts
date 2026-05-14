import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatInput} from '@angular/material/input';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {SettingService} from '../../../../services/setting.service';
import {MySettings} from '../../../../domain/setting/MySettings';
import {Tag} from '../../../../domain/Tag';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {NotificationService} from '../../../../services/notification.service';

@Component({
    selector: 'app-tags-form',
    imports: [
        FormsModule,
        CommonModule,
        MatFormFieldModule,
        MatIconModule,
        MatButtonModule,
        MatTooltipModule,
        MatInput
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './tags-form.component.html',
    styleUrl: './tags-form.component.scss'
})
export class TagsFormComponent implements OnInit{

  newTagName: string = '';
  editingTagId: string | null = null;

  constructor(
    private settingService: SettingService,
    public settingStorage: SettingStorageService,
    private notification: NotificationService,
  ) {
  }

  ngOnInit() {
    if (!this.settingStorage.settings) {
      this.settingStorage.settings = new MySettings();
    }
    if (!this.settingStorage.settings.tags) {
      this.settingStorage.settings.tags = [];
    }
  }

  addFromInput() {
    const value = this.newTagName?.trim();
    if (!value) return;

    if (!this.settingService.existTag(value)) {
      this.settingService.addTag(value);
      this.newTagName = '';
    } else {
      this.notification.error('Tag "' + value + '" already exists');
    }
  }

  async remove(tag: Tag) {
    await this.settingService.removeTag(tag);
  }

  startEdit(tag: Tag) {
    this.editingTagId = tag.id;
  }

  cancelEdit() {
    this.editingTagId = null;
  }

  saveEdit(tag: Tag, newName: string) {
    this.editingTagId = null;
    const value = newName?.trim();
    if (!value) {
      this.remove(tag);
      return;
    }
    if (!this.settingService.existTag(value, tag.id)) {
      this.settingService.updateTag(tag, value);
    } else {
      this.notification.error('Tag "' + value + '" already exists');
    }
  }

  updateColor(tag: Tag, event: any): void {
    const color = event.target.value.trim();
    if (color) {
      this.settingService.updateTagColor(tag, color);
    }
  }
}
