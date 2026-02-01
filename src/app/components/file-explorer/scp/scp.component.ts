import { HttpClient } from '@angular/common/http';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Profile, ProfileCategory, ProfileType } from '../../../domain/profile/Profile';
import { Session } from '../../../domain/session/Session';
import { SSHSession } from '../../../domain/session/SSHSession';
import { TabInstance } from '../../../domain/TabInstance';
import { ElectronTerminalService } from '../../../services/electron/electron-terminal.service';
import { ScpService } from '../../../services/file-explorer/scp.service';
import { TabService } from '../../../services/tab.service';
import { AbstractFileManager } from '../abstract-file-manager';
import { FileListComponent } from '../custom/file-list.component';

@Component({
    selector: 'app-scp',
    imports: [
        FileListComponent,
        MatButtonModule,
        MatIconModule
    ],
    templateUrl: './scp.component.html',
    styleUrl: './scp.component.css'
})
export class ScpComponent extends AbstractFileManager implements OnInit, OnDestroy {

  @Input() public session!: Session;


  constructor(private scpService: ScpService, http: HttpClient, private tabService: TabService, private electronTerminalService: ElectronTerminalService) {
    super(http);
  }

  ngOnInit(): void {
    this.session.open();

    if (this.session.profile?.sshProfile?.initPath) {
      this.path = this.session.profile.sshProfile.initPath;
    }
    this.ajaxSettings = this.generateAjaxSettings();
  }


  ngOnDestroy(): void {
    const isTabStillActive = this.tabService.tabs.some(t => t.id === this.session.id);
    if (!isTabStillActive) {
      this.session.close();
    }
  }

  generateAjaxSettings(): any {
    return this.scpService.setup(this.session);
  }

  getCurrentPath(): string | undefined {
    return this.path;
  }

  openSshTerminal() {
    if (!this.session?.profile) return;

    // Clone the profile
    const sshProfile = Profile.clone(this.session.profile);
    sshProfile.category = ProfileCategory.TERMINAL;
    sshProfile.profileType = ProfileType.SSH_TERMINAL;
    
    // Create new session
    const session = new SSHSession(sshProfile, ProfileType.SSH_TERMINAL, this.tabService, this.electronTerminalService);
    
    // Create new tab instance
    const tabInstance = new TabInstance(ProfileCategory.TERMINAL, session);
    
    // Add tab
    this.tabService.addTab(tabInstance);
    
    // Connect (handled by tab service/component usually, but let's see if we need to trigger it manually)
    // Session.open calls tabService.connected(id), but that just marks it connected? 
    // Usually the view (TerminalComponent) calls session.open() or similar. 
    // By adding the tab, the MainComponent (or whoever renders tabs) will create the component, which calls ngOnInit.
    // So we just need to add the tab.
  }
}
