import { Injectable } from '@angular/core';
import {ElectronService} from './electron.service';

@Injectable({
  providedIn: 'root'
})
export class LogService {

  constructor(private electronService: ElectronService) { }


  public info(message: string): void {
    this.electronService.log({level: 'info', message: message});
  }

  public debug(message: string): void {
    this.electronService.log({level: 'debug', message: message});
  }

  public error(message: string): void {
    this.electronService.log({level: 'error', message: message});
  }

  public warn(message: string): void {
    this.electronService.log({level: 'warn', message: message});
  }


  public trace(message: string): void {
    this.electronService.log({level: 'trace', message: message});
  }

  public fatal(message: string): void {
    this.electronService.log({level: 'fatal', message: message});
  }
}
