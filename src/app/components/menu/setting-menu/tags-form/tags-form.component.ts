import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {
  MatChipEditedEvent,
  MatChipInputEvent,
  MatChipsModule
} from '@angular/material/chips';
import {MatIconModule} from '@angular/material/icon';
import {SettingStorageService} from '../../../../services/setting-storage.service';
import {SettingService} from '../../../../services/setting.service';
import {MySettings} from '../../../../domain/setting/MySettings';
import {COMMA, ENTER} from '@angular/cdk/keycodes';
import {Tag} from '../../../../domain/Tag';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {NotificationService} from '../../../../services/notification.service';

@Component({
  selector: 'app-tags-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    MatFormFieldModule,
    MatChipsModule,
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tags-form.component.html',
  styleUrl: './tags-form.component.scss'
})
export class TagsFormComponent implements OnInit{

  readonly addOnBlur = true;
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
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

  add(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      if (!this.settingService.existTag(value)) {
        this.settingService.addTag(value);
      } else {
        this.notification.error('Cannot add duplicate tag');
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
      this.notification.error('Already have this tag:' + value);
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
}
