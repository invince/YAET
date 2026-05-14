import {ModalControllerService} from './modal-controller.service';
import {MenuConsts} from '../domain/MenuConsts';

describe('ModalControllerService', () => {
  let service: ModalControllerService;

  beforeEach(() => {
    service = new ModalControllerService();
  });

  it('should start closed with no menu', () => {
    expect(service.isMenuModalOpen).toBeFalse();
    expect(service.currentOpenedMenu).toBe('');
  });

  describe('toggleMenu', () => {
    it('should open a menu when currently closed', () => {
      service.toggleMenu(MenuConsts.MENU_SETTING);
      expect(service.isMenuModalOpen).toBeTrue();
      expect(service.currentOpenedMenu).toBe(MenuConsts.MENU_SETTING);
    });

    it('should close the same menu when toggled again', () => {
      service.toggleMenu(MenuConsts.MENU_SETTING);
      service.toggleMenu(MenuConsts.MENU_SETTING);
      expect(service.isMenuModalOpen).toBeFalse();
    });

    it('should switch to a different menu when toggled with a new menu', () => {
      service.toggleMenu(MenuConsts.MENU_PROFILE);
      service.toggleMenu(MenuConsts.MENU_CLOUD);
      expect(service.isMenuModalOpen).toBeTrue();
      expect(service.currentOpenedMenu).toBe(MenuConsts.MENU_CLOUD);
    });

    it('should emit closeEvent when MENU_PROFILE is toggled while already open', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.toggleMenu(MenuConsts.MENU_PROFILE);
      service.toggleMenu(MenuConsts.MENU_PROFILE);

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_PROFILE]);
    });

    it('should emit closeEvent when MENU_SECURE is toggled while already open', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.toggleMenu(MenuConsts.MENU_SECURE);
      service.toggleMenu(MenuConsts.MENU_SECURE);

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_SECURE]);
    });

    it('should emit closeEvent when MENU_PROXY is toggled while already open', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.toggleMenu(MenuConsts.MENU_PROXY);
      service.toggleMenu(MenuConsts.MENU_PROXY);

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_PROXY]);
    });

    it('should NOT emit closeEvent for MENU_SETTING when toggled while open', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.toggleMenu(MenuConsts.MENU_SETTING);
      service.toggleMenu(MenuConsts.MENU_SETTING);

      expect(emitted.length).toBe(0);
    });
  });

  describe('closeModal', () => {
    it('should close the modal when called without arguments', () => {
      service.toggleMenu(MenuConsts.MENU_SETTING);
      service.closeModal();
      expect(service.isMenuModalOpen).toBeFalse();
    });

    it('should emit closeEvent with single menu name', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.closeModal(MenuConsts.MENU_PROFILE);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_PROFILE]);
    });

    it('should emit closeEvent with multiple menu names', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.closeModal([MenuConsts.MENU_PROFILE, MenuConsts.MENU_SECURE]);
      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_PROFILE, MenuConsts.MENU_SECURE]);
    });

    it('should NOT close modal when closeByChild is true', () => {
      service.toggleMenu(MenuConsts.MENU_PROFILE);
      service.closeModal(MenuConsts.MENU_PROFILE, true);
      expect(service.isMenuModalOpen).toBeTrue();
    });

    it('should still emit closeEvent when closeByChild is true', () => {
      let emitted: string[][] = [];
      service.modalCloseEvent.subscribe(e => emitted.push(e));

      service.toggleMenu(MenuConsts.MENU_PROFILE);
      service.closeModal(MenuConsts.MENU_PROFILE, true);

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toEqual([MenuConsts.MENU_PROFILE]);
    });
  });
});
