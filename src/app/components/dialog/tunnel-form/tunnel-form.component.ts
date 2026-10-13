import {CommonModule} from '@angular/common';
import {Component, Inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef} from '@angular/material/dialog';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon} from '@angular/material/icon';
import {MatInput} from '@angular/material/input';
import {MatRadioModule} from '@angular/material/radio';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {TranslateModule} from '@ngx-translate/core';
import {Profile} from '../../../domain/profile/Profile';
import {
  DEFAULT_BIND_HOST,
  DEFAULT_REMOTE_BIND,
  REMOTE_BIND_OPTIONS,
  TUNNEL_TYPES,
  Tunnel,
  TunnelConnectionMode,
  TunnelType,
  validateTunnelRule,
} from '../../../domain/profile/TunnelRule';
import {DirectionHint, directionHint, needsConnectionApproval} from '../../menu/tunnels-menu/tunnel-display';
import {Secret, SecretType} from '../../../domain/Secret';
import {Proxy} from '../../../domain/Proxy';
import {NotificationService} from '../../../services/notification.service';
import {ProfileService} from '../../../services/profile.service';
import {ProxyStorageService} from '../../../services/proxy-storage.service';
import {SecretStorageService} from '../../../services/secret-storage.service';
import {SecretService} from '../../../services/secret.service';
import {SecretQuickFormComponent} from '../secret-quick-form/secret-quick-form.component';

export interface TunnelFormData {
  tunnel: Tunnel;
  isNew: boolean;
}

@Component({
  selector: 'app-tunnel-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInput,
    MatIcon,
    MatSelectModule,
    MatRadioModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './tunnel-form.component.html',
  styleUrl: './tunnel-form.component.scss'
})
export class TunnelFormComponent {
  tunnel: Tunnel;
  isNew: boolean;
  TUNNEL_TYPES = TUNNEL_TYPES;
  REMOTE_BIND_OPTIONS = REMOTE_BIND_OPTIONS;
  DEFAULT_BIND_HOST = DEFAULT_BIND_HOST;
  DEFAULT_REMOTE_BIND = DEFAULT_REMOTE_BIND;

  sshProfiles: Profile[] = [];
  secrets: Secret[] = [];
  proxies: Proxy[] = [];

  constructor(
    private dialogRef: MatDialogRef<TunnelFormComponent>,
    @Inject(MAT_DIALOG_DATA) data: TunnelFormData,
    public profileService: ProfileService,
    public secretStorageService: SecretStorageService,
    public secretService: SecretService,
    public proxyStorageService: ProxyStorageService,
    private notification: NotificationService,
    public dialog: MatDialog,
  ) {
    this.tunnel = JSON.parse(JSON.stringify(data.tunnel));
    if (!this.tunnel.connection) this.tunnel.connection = { mode: 'profile' };
    if (!this.tunnel.remoteBind) this.tunnel.remoteBind = DEFAULT_REMOTE_BIND;
    this.isNew = data.isNew;
    this.sshProfiles = (this.profileService.profilesCopy.profiles || [])
      .filter(p => p.profileType === 'SSH_TERMINAL');
    this.secrets = (this.secretStorageService.dataCopy.secrets || [])
      .filter(s => s.secretType === SecretType.LOGIN_PASSWORD || s.secretType === SecretType.SSH_KEY);
    this.proxies = this.proxyStorageService.dataCopy.proxies || [];
  }

  typeLabel(type: TunnelType): string {
    return `TUNNELS.TYPE_${type.toUpperCase()}`;
  }

  direction(): DirectionHint {
    return directionHint(this.tunnel, 0);
  }

  needsApproval(): boolean {
    return needsConnectionApproval(this.tunnel);
  }

  forwardError(): string | null {
    return validateTunnelRule(this.tunnel);
  }

  setType(type: TunnelType): void {
    this.tunnel.type = type;
    if (type !== 'local') {
      this.tunnel.remoteHost = '';
    }
    if (type === 'dynamic') {
      this.tunnel.remotePort = 0;
    }
  }

  setConnectionMode(mode: TunnelConnectionMode): void {
    this.tunnel.connection.mode = mode;
  }

  setAuthType(authType: 'login' | 'secret'): void {
    this.tunnel.connection.authType = authType;
  }

  onPortInput(field: 'localPort' | 'remotePort' | 'port', raw: string): void {
    const value = raw === '' ? 0 : Math.trunc(Number(raw));
    const parsed = Number.isNaN(value) ? 0 : value;
    if (field === 'port') {
      this.tunnel.connection.port = parsed || 22;
    } else {
      this.tunnel[field] = parsed;
    }
  }

  quickCreateSecret(): void {
    this.dialog.open(SecretQuickFormComponent, {
      width: '650px',
      data: { secretTypes: [SecretType.LOGIN_PASSWORD, SecretType.SSH_KEY] }
    });
  }

  connectionError(): string | null {
    const conn = this.tunnel.connection;
    if (conn.mode === 'profile') {
      if (!conn.profileId) return 'TUNNELS.ERROR_NO_PROFILE';
      return null;
    }
    if (!conn.host || !conn.host.trim()) return 'TUNNELS.ERROR_NO_HOST';
    if (conn.authType === 'secret') {
      if (!conn.secretId) return 'TUNNELS.ERROR_NO_SECRET';
      return null;
    }
    if (!conn.login || !conn.login.trim()) return 'TUNNELS.ERROR_NO_LOGIN';
    if (!conn.password) return 'TUNNELS.ERROR_NO_PASSWORD';
    return null;
  }

  get valid(): boolean {
    return !this.forwardError() && !this.connectionError();
  }

  onSave(): void {
    if (!this.valid) {
      this.notification.error('Tunnel configuration is incomplete');
      return;
    }
    if (!this.tunnel.name || !this.tunnel.name.trim()) {
      this.tunnel.name = this.defaultName();
    }
    this.dialogRef.close(this.tunnel);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  private defaultName(): string {
    if (this.tunnel.type === 'dynamic') return `dynamic ${this.tunnel.localPort}`;
    if (this.tunnel.type === 'remote') return `remote ${this.tunnel.remotePort} → ${this.tunnel.localPort}`;
    return `local ${this.tunnel.localPort} → ${this.tunnel.remoteHost}:${this.tunnel.remotePort}`;
  }
}
