import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { MenuConsts } from '../domain/MenuConsts';

@Injectable({
  providedIn: 'root'
})
export class ModalControllerService {

  private _isMenuModalOpen = false; // if menu modal open
  private _currentOpenedMenu = '';

  private modalCloseSubject = new Subject<string[]>();
  public readonly modalCloseEvent = this.modalCloseSubject.asObservable(); // Expose as Observable
  constructor() { }

  get isMenuModalOpen(): boolean {
    return this._isMenuModalOpen;
  }

  get currentOpenedMenu(): string {
    return this._currentOpenedMenu;
  }

  closeModal(possibleModal: string | string[] | undefined = undefined, closeByChild: boolean = false) {
    if (!closeByChild) {
      this._isMenuModalOpen = false;
    }
    if (possibleModal) {
      if (Array.isArray(possibleModal)) {
        this.modalCloseSubject.next(possibleModal);
      } else {
        this.modalCloseSubject.next([possibleModal]);
      }
    }
  }

  toggleMenu(menu: string) {
    if (this._currentOpenedMenu == menu) {

      if (this._isMenuModalOpen &&
        [MenuConsts.MENU_PROFILE, MenuConsts.MENU_SECURE, MenuConsts.MENU_PROXY].includes(menu)) {
        this.closeModal(menu, true);
        return;
      }
      this._isMenuModalOpen = !this._isMenuModalOpen;
    } else {
      this._currentOpenedMenu = menu;
      this._isMenuModalOpen = true;
    }
  }
}
