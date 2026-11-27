import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule, Validators} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton} from '@angular/material/button';
import {TranslateModule} from '@ngx-translate/core';
import {ProfileFormBase, profileFormProviders} from '../../../src/app/components/forms/profile-form.base';
import {FormModelBridge} from '../../../src/app/utils/model-form.bridge';

interface SerialProfileData {
  path: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  rtscts: boolean;
  xon: boolean;
  xoff: boolean;
}

@Component({
  selector: 'app-serial-profile-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    MatFormFieldModule,
    MatInput,
    MatSelectModule,
    MatCheckbox,
    MatIcon,
    MatButton,
    MatIconButton
  ],
  providers: profileFormProviders(() => SerialProfileFormComponent),
  template: `
    <div [formGroup]="form" class="serial-form-container">
      <mat-form-field class="field">
        <mat-label>{{ 'PROFILES.SERIAL_PORT' | translate }}</mat-label>
        <input matInput type="text" formControlName="path" placeholder="e.g. COM1 or /dev/ttyUSB0" required />
        @if (form.get('path')?.value) {
          <button matSuffix mat-icon-button type="button" aria-label="Clear" (click)="form.get('path')?.setValue('')">
            <mat-icon>close</mat-icon>
          </button>
        }
        <button matSuffix mat-icon-button type="button" (click)="refreshPorts(); $event.stopPropagation();" title="Scan Serial Ports">
          <mat-icon>refresh</mat-icon>
        </button>
        @if (form.get('path')?.invalid && form.get('path')?.touched) {
          <mat-error>{{ errorFor('path') | translate }}</mat-error>
        }
      </mat-form-field>

      @if (availablePorts.length > 0) {
        <div class="discovered-ports">
          <div class="ports-title">Discovered Ports (Click to select):</div>
          <div class="ports-container">
            @for (port of availablePorts; track port.path) {
              <button mat-stroked-button type="button" (click)="form.get('path')?.setValue(port.path)">
                {{ port.path }} @if (port.manufacturer) { ({{ port.manufacturer }}) }
              </button>
            }
          </div>
        </div>
      }

      <div class="field-row">
        <mat-form-field class="field">
          <mat-label>Baud Rate</mat-label>
          <mat-select formControlName="baudRate" required>
            @for (baud of baudRates; track baud) {
              <mat-option [value]="baud">{{ baud }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="field">
          <mat-label>Data Bits</mat-label>
          <mat-select formControlName="dataBits" required>
            @for (bits of dataBitsList; track bits) {
              <mat-option [value]="bits">{{ bits }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="field-row">
        <mat-form-field class="field">
          <mat-label>Stop Bits</mat-label>
          <mat-select formControlName="stopBits" required>
            @for (stop of stopBitsList; track stop) {
              <mat-option [value]="stop">{{ stop }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="field">
          <mat-label>Parity</mat-label>
          <mat-select formControlName="parity" required>
            @for (parity of parities; track parity.value) {
              <mat-option [value]="parity.value">{{ parity.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="flow-control-group">
        <div class="flow-control-title">Flow Control</div>
        <div class="checkbox-row">
          <mat-checkbox formControlName="rtscts">RTS/CTS (Hardware)</mat-checkbox>
          <mat-checkbox formControlName="xon">XON</mat-checkbox>
          <mat-checkbox formControlName="xoff">XOFF</mat-checkbox>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      overflow: hidden;
      max-width: 100%;
    }
    .serial-form-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
      box-sizing: border-box;
      max-width: 100%;
    }
    .field {
      width: 100%;
      padding: 8px 0;
      margin-top: 16px;
    }
    .field-row {
      display: flex;
      gap: 12px;
      width: 100%;
      min-width: 0;
    }
    .field-row > .field {
      flex: 1 1 0;
      min-width: 0;
      margin-top: 0;
    }
    .discovered-ports {
      margin: 8px 0 16px 0;
      padding: 8px;
      border: 1px dashed var(--app-border-color, rgba(255, 255, 255, 0.15));
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.02);
    }
    .discovered-ports .ports-title {
      font-size: 11px;
      opacity: 0.6;
      margin-bottom: 4px;
    }
    .discovered-ports .ports-container {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .discovered-ports .ports-container button {
      font-size: 11px;
      line-height: 24px;
      height: 26px;
      padding: 0 8px;
    }
    .flow-control-group {
      margin-top: 16px;
      padding: 8px 0;
    }
    .flow-control-group .flow-control-title {
      font-weight: 500;
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    .flow-control-group .checkbox-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
  `]
})
export class SerialProfileFormComponent extends ProfileFormBase<SerialProfileData> {
  availablePorts: { path: string; manufacturer?: string; friendlyName?: string }[] = [];
  baudRates = [110, 300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200, 128000, 256000, 460800, 921600, 1500000];
  dataBitsList = [5, 6, 7, 8];
  stopBitsList = [1, 1.5, 2];
  parities = [
    { value: 'none', label: 'None' },
    { value: 'even', label: 'Even' },
    { value: 'odd', label: 'Odd' },
    { value: 'mark', label: 'Mark' },
    { value: 'space', label: 'Space' }
  ];

  protected override readonly bridge = new FormModelBridge<SerialProfileData>([
    {form: 'path', validators: [Validators.required], defaultValue: () => ''},
    {form: 'baudRate', validators: [Validators.required], defaultValue: () => 9600},
    {form: 'dataBits', validators: [Validators.required], defaultValue: () => 8},
    {form: 'stopBits', validators: [Validators.required], defaultValue: () => 1},
    {form: 'parity', validators: [Validators.required], defaultValue: () => 'none'},
    {form: 'rtscts', defaultValue: () => false},
    {form: 'xon', defaultValue: () => false},
    {form: 'xoff', defaultValue: () => false},
  ]);

  protected override createEmptyModel(): SerialProfileData {
    return {
      path: '',
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      rtscts: false,
      xon: false,
      xoff: false,
    };
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.refreshPorts();
  }

  async refreshPorts() {
    const ipc = (window as any).electronAPI;
    if (ipc && typeof ipc.invoke === 'function') {
      try {
        this.availablePorts = await ipc.invoke('serial.list-ports');
      } catch (err) {
        console.error('Failed to scan serial ports:', err);
      }
    }
  }
}
