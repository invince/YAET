import {Component, OnInit} from '@angular/core';
import {MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatButton} from '@angular/material/button';
import {MatCheckbox} from '@angular/material/checkbox';
import {MatIcon} from '@angular/material/icon';
import {MatProgressSpinner} from '@angular/material/progress-spinner';
import {FormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';

interface ExamplePlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  category: string;
  profileType: string;
  icon: string;
  installed: boolean;
  selected: boolean;
}

@Component({
    selector: 'app-example-plugin-install',
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButton,
        MatCheckbox,
        MatIcon,
        MatProgressSpinner,
        TranslateModule,
    ],
    templateUrl: './example-plugin-install.component.html',
    styleUrl: './example-plugin-install.component.scss'
})
export class ExamplePluginInstallComponent implements OnInit {

  examples: ExamplePlugin[] = [];
  loading = true;
  error = '';
  installing = false;

  constructor(
    public dialogRef: MatDialogRef<ExamplePluginInstallComponent>,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get installable(): ExamplePlugin[] {
    return this.examples.filter(e => !e.installed);
  }

  get anySelected(): boolean {
    return this.installable.some(e => e.selected);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const ipc = (window as any).electronAPI;
      const list: any[] = await ipc?.invoke('plugins.listExamples') ?? [];
      this.examples = list.map(e => ({...e, selected: !e.installed}));
    } catch (err: any) {
      this.error = err?.message || 'Failed to load example plugins';
    } finally {
      this.loading = false;
    }
  }

  toggleAll(checked: boolean): void {
    for (const e of this.installable) {
      e.selected = checked;
    }
  }

  get allSelected(): boolean {
    const avail = this.installable;
    return avail.length > 0 && avail.every(e => e.selected);
  }

  async install(): Promise<void> {
    const ids = this.installable.filter(e => e.selected).map(e => e.id);
    if (ids.length === 0) return;
    this.installing = true;
    this.error = '';
    try {
      const ipc = (window as any).electronAPI;
      const result = await ipc?.invoke('plugins.installExamples', ids);
      this.dialogRef.close(result);
    } catch (err: any) {
      this.error = err?.message || 'Install failed';
    } finally {
      this.installing = false;
    }
  }

  onClose(): void {
    this.dialogRef.close(null);
  }
}
