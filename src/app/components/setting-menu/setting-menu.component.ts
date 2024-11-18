import {Component} from '@angular/core';
import {MenuComponent} from '../menu/menu.component';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {MatTab, MatTabGroup} from '@angular/material/tabs';
import {MySettings} from '../../domain/MySettings';
import {SettingService} from '../../services/setting.service';
import {MatFormField, MatLabel} from '@angular/material/form-field';
import {MatOption, MatSelect} from '@angular/material/select';
import {LocalTerminalType} from '../../domain/LocalTerminalProfile';
import {CommonModule, KeyValuePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatInput} from '@angular/material/input';

@Component({
  selector: 'app-setting-menu',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    MatIcon,
    MatIconButton,
    MatTabGroup,
    MatTab,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    KeyValuePipe,
    MatInput,
    MatButton,
  ],
  templateUrl: './setting-menu.component.html',
  styleUrl: './setting-menu.component.css'
})
export class SettingMenuComponent extends MenuComponent {

  // @ts-ignore
  unordered = (a,b)=>0
  settings: MySettings;

  LOCAL_TERM_OPTION = LocalTerminalType;

  ui_showLocalTerminalCustom = false;

  constructor(private settingService: SettingService) {
    super();
    this.settings = this.clone(this.settingService.settings);
    if (this.settings.localTerminalSetting && this.settings.localTerminalSetting.type === LocalTerminalType.CUSTOM) {
      this.ui_showLocalTerminalCustom = true;
    }
  }


  clone(setting: MySettings): MySettings {
    return JSON.parse(JSON.stringify(setting));
  }


  override save() {
    this.settingService.save(this.settings);
  }



  onSelectLocalTerminalType($event: LocalTerminalType) {
    this.settings.localTerminalSetting.type = $event;
    this.ui_showLocalTerminalCustom = this.settings.localTerminalSetting.type === LocalTerminalType.CUSTOM;
    this.settingService.validateLocalTerminalSettings(this.settings.localTerminalSetting);
  }
}
