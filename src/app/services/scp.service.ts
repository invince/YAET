import { Injectable } from '@angular/core';
import {ElectronService} from './electron.service';
import {SSHProfile} from '../domain/profile/SSHProfile';

@Injectable({
  providedIn: 'root'
})
export class ScpService {

  constructor(private electron: ElectronService) { }

  async connect(id:string , sshProfile: SSHProfile) {
    return this.electron.registerScpSession(id , sshProfile);
  }
}
