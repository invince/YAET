import {DragDropTransferService} from './drag-drop-transfer.service';

describe('DragDropTransferService', () => {
  let service: DragDropTransferService;

  beforeEach(() => {
    service = new DragDropTransferService();
  });

  it('should start with no drag and not dragging', () => {
    expect(service.isDragging).toBeFalse();
    expect(service.getDragData()).toBeNull();
  });

  describe('startDrag', () => {
    it('should set dragging state and store drag data', () => {
      const settings = { url: 'sftp://server1' };
      const files = [{ name: 'file.txt' } as any];

      service.startDrag(settings, '/remote/path', files);

      expect(service.isDragging).toBeTrue();

      const data = service.getDragData();
      expect(data).not.toBeNull();
      expect(data!.ajaxSettings).toBe(settings);
      expect(data!.path).toBe('/remote/path');
      expect(data!.files).toBe(files);
    });
  });

  describe('endDrag', () => {
    it('should clear dragging state', () => {
      service.startDrag({ url: 'sftp://s' }, '/p', []);
      service.endDrag();

      expect(service.isDragging).toBeFalse();
      expect(service.getDragData()).toBeNull();
    });
  });

  describe('getDragData', () => {
    it('should return null when no drag is active', () => {
      expect(service.getDragData()).toBeNull();
    });

    it('should return drag data when drag is active', () => {
      service.startDrag({ url: 'sftp://s' }, '/p', [{ name: 'f' } as any]);
      expect(service.getDragData()).not.toBeNull();
    });
  });

  describe('canTransfer', () => {
    it('should return false when no drag is active', () => {
      expect(service.canTransfer({ url: 'sftp://dest' })).toBeFalse();
    });

    it('should return true when source and target URLs differ', () => {
      service.startDrag({ url: 'sftp://server1' }, '/src', []);
      expect(service.canTransfer({ url: 'sftp://server2' })).toBeTrue();
    });

    it('should return false when source and target URLs are the same', () => {
      const settings = { url: 'sftp://server1' };
      service.startDrag(settings, '/src', []);
      expect(service.canTransfer(settings)).toBeFalse();
    });

    it('should compare by url property', () => {
      service.startDrag({ url: 'sftp://server1', port: 22 }, '/src', []);
      expect(service.canTransfer({ url: 'sftp://server1', port: 2222 })).toBeFalse();
    });

    it('should handle null target settings gracefully', () => {
      service.startDrag({ url: 'sftp://s' }, '/p', []);
      expect(service.canTransfer(null)).toBeTrue();
    });

    it('should handle target settings with undefined url', () => {
      service.startDrag({ url: 'local' }, '/p', []);
      expect(service.canTransfer({})).toBeTrue();
    });
  });

  describe('isSameConnection', () => {
    it('should return false when no drag is active', () => {
      expect(service.isSameConnection({ url: 'sftp://s' })).toBeFalse();
    });

    it('should return true when URLs match', () => {
      const settings = { url: 'sftp://server1' };
      service.startDrag(settings, '/src', []);
      expect(service.isSameConnection(settings)).toBeTrue();
    });

    it('should return false when URLs differ', () => {
      service.startDrag({ url: 'sftp://server1' }, '/src', []);
      expect(service.isSameConnection({ url: 'sftp://server2' })).toBeFalse();
    });
  });
});
