import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {SecretsService} from '../../../services/secrets.service';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatButton, MatIconButton, MatMiniFabButton} from '@angular/material/button';
import {CommonModule, SlicePipe} from '@angular/common';
import {Secret} from '../../../domain/Secret';
import {FormsModule} from '@angular/forms';
import {MatSidenav, MatSidenavContainer, MatSidenavContent} from '@angular/material/sidenav';
import {SecretFormComponent} from '../secret-form/secret-form.component';

@Component({
  selector: 'app-secure-menu',
  standalone: true,
  imports: [
    MatFormField,
    MatOption,
    MatInput,
    MatSuffix,
    MatIcon,
    MatIconButton,
    MatLabel,
    CommonModule,
    FormsModule,
    SlicePipe,
    MatSidenavContainer,
    MatSidenav,
    MatSidenavContent,
    MatButton,
    SecretFormComponent,
    MatMiniFabButton,
  ],
  templateUrl: './secures-menu.component.html',
  styleUrl: './secures-menu.component.css'
})
export class SecuresMenuComponent extends MenuComponent implements OnInit, OnDestroy {

  selectedIndex!: number;
  secretFormLastDirtyState = false;

  constructor(
    public secretsService: SecretsService) {
    super();
  }
  ngOnDestroy(): void {
  }

  ngOnInit(): void {
  }

  addTab() {
    this.secretsService.secrets.push(new Secret());
    this.selectedIndex = this.secretsService.secrets.length - 1; // Focus on the newly added tab
  }

  removeTab(index: number) {
    this.secretsService.secrets.splice(index, 1);
    this.selectedIndex = Math.min(this.selectedIndex, this.secretsService.secrets.length - 1);
  }

  onTabChange(i: number) {
    this.selectedIndex = i;
  }

  onDelete($event: Secret) {

  }

  onSaveOne($event: Secret) {
    if ($event) {
      if ($event.isNew) {

      }
    }
  }

  onCancel($event: Secret) {
    if ($event) {
      if ($event.isNew) {
        this.secretsService.deleteLocal($event);
      }
    }
  }

  onFormDirtyStateChange($event: boolean) {
    this.secretFormLastDirtyState = $event;
  }

  secretTabLabel(secret: Secret) {
    let label = 'New';
    if (secret && secret.name) {
      label = secret.name;
      if (secret.name.length > 6) {
        label = label.slice(0, 6) + '...';
      }
    }
    if (this.secretFormLastDirtyState) {
      label += '*'
    }
    return label;
  }
}
