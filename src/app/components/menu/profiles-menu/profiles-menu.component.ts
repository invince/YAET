import {ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {MatIcon} from "@angular/material/icon";
import {MatSidenavModule} from '@angular/material/sidenav';
import {MenuComponent} from '../menu.component';
import {ProfileService} from '../../../services/profile.service';
import {Profile, Profiles} from '../../../domain/profile/Profile';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInput} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';
import {ProfileFormComponent} from '../profile-form/profile-form.component';
import {HasChildForm} from '../../EnhancedFormMixin';
import {SettingStorageService} from '../../../services/setting-storage.service';
import {Subscription} from 'rxjs';
import {SettingService} from '../../../services/setting.service';
import {FilterKeywordPipe} from '../../../pipes/filter-keyword.pipe';
import {MatTree, MatTreeModule, MatTreeNestedDataSource} from '@angular/material/tree'
import {GroupNode, NODE_DEFAULT_NAME} from '../../../domain/GroupNode';
import {NestedTreeControl} from '@angular/cdk/tree';
import {SideNavType} from '../../../domain/setting/UISettings';
import {MatDialog} from '@angular/material/dialog';
import {ConfirmationComponent} from '../../confirmation/confirmation.component';
import {ModalControllerService} from '../../../services/modal-controller.service';
import {MenuConsts} from '../../../domain/MenuConsts';
import {Tag} from '../../../domain/Tag';
import {NotificationService} from '../../../services/notification.service';

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

    MatInput,
    MatIcon,

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

  profilesCopy!: Profiles;

  subscriptions: Subscription[] = []
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
    private notification: NotificationService,
    private modalControl: ModalControllerService,
    private keywordPipe: FilterKeywordPipe,

    private cdr: ChangeDetectorRef,

    private dialog: MatDialog,
  ) {
    super();
  }

  ngOnDestroy(): void {
    if (this.subscriptions) {
      this.subscriptions.forEach(one => one.unsubscribe());
    }
  }

  ngOnInit(): void {
    this.subscriptions.push(this.modalControl.modalCloseEvent.subscribe(one => {
      if (one && one.includes(MenuConsts.MENU_PROFILE)) {
        this.modalControl.closeModal();
      }
    }));
    if (!this.profileService.isLoaded) {
      let message = 'Profiles not loaded, we\'ll reload it, please close Profile menu and reopen';
      if (!this.settingService.isLoaded) {
        message = 'Settings And ' + message
        this.settingService.reload();
      }
      this.profileService.reload();
      this.notification.info(message);
    }

    this.profilesCopy = this.profileService.profilesCopy;
    this.profilesCopy.profiles = this.profilesCopy.profiles.sort((a: Profile, b: Profile) => a.name.localeCompare(b.name));
    this.sideNavType = this.settingStorage.settings.ui.profileSideNavType;
    this.refreshForm();
  }

  addTab() {
    this.doAddTabOfProfile(new Profile());
  }

  doAddTabOfProfile(newProfile: Profile) {
    this.profilesCopy.profiles.push(newProfile);
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

  onCloneOne($event: Profile) {
    // we'll add a new tab, and copy all the fields of $event
    this.doAddTabOfProfile(Profile.clone($event));
  }

  onTabConnect(profile: Profile) {
    this.profileService.onProfileConnect(profile);
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
      this.notification.info('Please finish current form');
      return;
    }
    this.selectedProfile = profile;
    this.selectedProfileId = profile.id;

    this.cdr.detectChanges();
    // this.refreshSecretForm();
  }


  async onDelete($event: Profile) {
    const dialogRef = this.dialog.open(ConfirmationComponent, {
      width: '300px',
      data: { message: 'Do you want to delete this profile: ' + $event.name + '?' },
    });

    this.subscriptions.push(dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.profilesCopy.delete($event);
        await this.commitChange();
        this.selectedProfileId = undefined;
        this.selectedProfile = undefined;
        this.refreshForm();
      }
    }));
  }

  async onSaveOne($event: Profile) {
    this.profilesCopy.update($event);
    await this.commitChange();
    this.refreshForm();
  }

  onCancel($event: Profile) {
    this.close();
  }

  displayProfileTabLabel(profile: Profile | GroupNode) {
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

  public tagsColor(profile: Profile): string[] {
    return profile.tags.map(one => this.settingService.findTagById(one))
      .filter((one): one is Tag => !!one)// filter undefined
      .map(tag => tag.color);
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
          .filter((one): one is Tag => !!one)// filter undefined
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
      this.keywordPipe.transform(this.profilesCopy.profiles, this.keywordsProviders, this.filter),
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

  async commitChange() {
    await this.profileService.save(this.profilesCopy);
  }


}
