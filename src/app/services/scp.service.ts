import { Injectable } from '@angular/core';
import {ElectronService} from './electron.service';
import {SSHProfile} from '../domain/profile/SSHProfile';

@Injectable({
  providedIn: 'root'
})
export class ScpService {

  constructor(private electron: ElectronService) { }

  connect(id:string , sshProfile: SSHProfile) {
    this.electron.registerScpSession(id , sshProfile);
  }
}
