import {Component, OnDestroy, OnInit} from '@angular/core';
import {MenuComponent} from '../menu.component';
import {SecretsService} from '../../../services/secrets.service';
import {MatTab, MatTabChangeEvent, MatTabGroup, MatTabLabel} from '@angular/material/tabs';
import {MatFormField, MatLabel, MatSuffix} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatIcon} from '@angular/material/icon';
import {MatIconButton} from '@angular/material/button';
import {CommonModule, NgForOf, SlicePipe} from '@angular/common';
import {Secret} from '../../../domain/Secret';
import {Subscription} from 'rxjs';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-secure-menu',
  standalone: true,
  imports: [
    MatTabGroup,
    MatTab,
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
    MatTabLabel,
  ],
  templateUrl: './secure-menu.component.html',
  styleUrl: './secure-menu.component.css'
})
export class SecureMenuComponent  extends MenuComponent implements OnInit, OnDestroy {

  secrets!: Secret[];

  currentSecret!: Secret;
  selectedIndex!: number;

  modificationNotSaved: boolean = false;

  constructor(public secretsService: SecretsService) {
    super();
  }
  ngOnDestroy(): void {
  }

  ngOnInit(): void {
  }

  addTab() {
    this.secretsService.secrets.push(new Secret());
    this.selectedIndex = this.secretsService.secrets.length - 1; // Focus on the newly added tab
    this.modificationNotSaved = true;
  }

  removeTab(index: number) {
    this.secretsService.secrets.splice(index, 1);
    this.selectedIndex = Math.min(this.selectedIndex, this.secretsService.secrets.length - 1);
  }

  onTabChange(event: any) {
    console.log('Tab changed to:', event.index);
  }
}
