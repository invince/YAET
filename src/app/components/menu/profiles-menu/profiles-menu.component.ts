import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {MatSidenavModule} from '@angular/material/sidenav';
import {MenuComponent} from '../menu.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {ProfileService} from '../../../services/profile.service';
import {Profile} from '../../../domain/Profile';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatOption} from '@angular/material/autocomplete';
import {MatInput} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {MatSelect} from '@angular/material/select';
import {ProfileFormComponent} from '../profile-form/profile-form.component';
import {HasChildForm} from '../../enhanced-form-mixin';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {ModalControllerService} from '../../../services/modal-controller.service';
import {Subscription} from 'rxjs';
import {SettingService} from '../../../services/setting.service';
import {FilterKeywordPipe} from '../../../pipes/filter-keyword.pipe';
import {MatTree, MatTreeModule, MatTreeNestedDataSource} from '@angular/material/tree'
import {NODE_DEFAULT_NAME, GroupNode} from '../../../domain/GroupNode';
import {NestedTreeControl} from '@angular/cdk/tree';
import {SideNavType} from '../../../domain/UISettings';

@Component({
  selector: 'app-profiles-menu',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,

    MatFormFieldModule,
    MatSidenavModule,
    MatButtonModule,
    MatTreeModule,

    MatOption,
    MatInput,
    MatIcon,

    MatSelect,
    ProfileFormComponent,
    FilterKeywordPipe,
  ],
  templateUrl: './profiles-menu.component.html',
  styleUrl: './profiles-menu.component.scss',
  providers: [FilterKeywordPipe]
})
export class ProfilesMenuComponent extends HasChildForm(MenuComponent) implements OnInit, OnDestroy {

  selectedProfileId: string | undefined;
  selectedProfile: Profile | undefined;

  subscription!: Subscription;
  filter!: string;

  sideNavType!: string;

  // dataSource: GroupNode[] = [];
  treeDataSource = new MatTreeNestedDataSource<GroupNode>();
  treeControl = new NestedTreeControl<GroupNode>(node => node.children);

  @ViewChild('tree') tree!: MatTree<any>;
  expandedNodes: Set<any> = new Set();

  constructor(
    public profileService: ProfileService,
    public settingStorage: SettingStorageService,
    private settingService: SettingService,
    private _snackBar: MatSnackBar,

    private modalControl: ModalControllerService,

    private keywordPipe: FilterKeywordPipe,
  ) {
    super();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.subscription = this.modalControl.modalCloseEvent.subscribe(one => {
      if (one && one.includes('favorite')) {
        this.profileService.deleteNotSavedNewProfileInLocal();
        this.modalControl.closeModal();
      }
    });

    this.sideNavType = this.settingStorage.settings.ui.profileSideNavType;
    this.refreshForm();
  }

  addTab() {
    let newProfile = new Profile();
    this.profileService.profiles.push(newProfile);
    this.selectedProfileId = newProfile.id;// Focus on the newly added tab
    this.selectedProfile = newProfile;
    this.refreshForm();
    if (this.sideNavType == SideNavType.TREE) {
      this.treeControl.dataNodes?.forEach((node) => {
        if (node.name == NODE_DEFAULT_NAME) {
          this.treeControl.expand(node);
        }
      });
    }
  }

  onTabChange(profile: Profile) {
    if (!profile) {
      return;
    }
    if (this.selectedProfileId == profile.id) {
      this.selectedProfile = profile;
      return;
    }
    if (this.selectedProfileId &&
      (this.lastChildFormInvalidState || this.lastChildFormDirtyState)) {
      this._snackBar.open('Please finish current form', 'Ok', {
        duration: 3000
      });
      return;
    }
    this.selectedProfile = profile;
    this.selectedProfileId = profile.id;
    // this.refreshSecretForm();
  }


  async onDelete($event: Profile) {
    this.profileService.deleteLocal($event);
    if (!$event.isNew) {
      await this.profileService.saveAll();
    }
    this.selectedProfileId = undefined;
    this.selectedProfile = undefined;
    this.refreshForm();
  }

  async onSaveOne($event: Profile) {
    this.profileService.updateProfile($event);
    await this.profileService.saveAll();
    this.refreshForm();
  }

  onCancel($event: Profile) {
    if ($event) {
      if ($event.isNew) {
        this.profileService.deleteLocal($event);
      }
    }
    this.close();
  }

  profileTabLabel(profile: Profile | GroupNode) {
    let LIMIT = this.settingStorage.settings?.ui?.profileLabelLength || 10;

    let label = 'New';
    if (profile && profile.name) {
      label = profile.name;
      if (profile.name.length > LIMIT) {
        label = label.slice(0, LIMIT) + '...';
      }
    }
    if (profile.id == this.selectedProfileId && this.lastChildFormDirtyState) {
      label += '*'
    }
    return label;
  }

  hasNewProfile() {
    return this.selectedProfile?.isNew;
  }


  keywordsProviders: ((profile: Profile) => string | string[])[] = [
    (profile: Profile) => profile.name,
    (profile: Profile) => profile.comment,
    (profile: Profile) => profile.category,
    (profile: Profile) => profile.profileType,
    (profile: Profile) => {
        if (profile.group) {
          let group = this.settingService.findGroupById(profile.id);
          if (group) {
            return [group.name];
          }
        }
        return [];
    },
    (profile: Profile) => {
      if (profile.tags) {
        return profile.tags.map(one => this.settingService.findTagById(one))
          .filter(one => one !== undefined)
          .map(one => one.name);
      }
      return [];
    },
  ];

  // Track expanded nodes before updating the data source
  recordExpandedNodes() {
    if (this.sideNavType == SideNavType.TREE) {
      this.expandedNodes.clear();
      this.treeControl.dataNodes?.forEach((node) => {
        if (this.treeControl.isExpanded(node)) {
          this.expandedNodes.add(node.id); // NOTE: each time we recreate the tree, so node is not the same, we keep only id to identify
        }
      });
    }
  }

  // Restore the expanded state after updating the data source
  restoreExpandedNodes() {
    if (this.sideNavType == SideNavType.TREE) {
      this.treeControl.dataNodes?.forEach((node) => {
        if (this.expandedNodes.has(node.id)) {
          this.treeControl.expand(node);
        }
      });
    }
  }


  createGroupDataSource(): GroupNode[] {
    return GroupNode.map2DataSource(
      this.settingStorage.settings.groups,
      this.keywordPipe.transform(this.profileService.profiles, this.keywordsProviders, this.filter),
      false,
      true);
  }

  hasChild(_: number, node: GroupNode): boolean {
    return !!node.children && node.children.length > 0;
  }

  private refreshForm() {
    this.recordExpandedNodes();
    let data = this.createGroupDataSource();
    this.treeDataSource.data = data;
    this.treeControl.dataNodes = data;
    this.restoreExpandedNodes();
  }

  changeSideNavType(type: string) {
    if (this.sideNavType != type) {
      this.expandedNodes.clear();
    }
    this.sideNavType = type;

  }

  applyFilterToTree() {
    this.refreshForm();
  }

  clearFilter() {
    this.filter = '';
    this.applyFilterToTree();
  }
}
