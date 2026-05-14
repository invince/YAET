import {TabService} from './tab.service';
import {TabInstance} from '../domain/TabInstance';
import {Profile, ProfileCategory, ProfileType} from '../domain/profile/Profile';
import {Session} from '../domain/session/Session';

function createTab(name: string, category: ProfileCategory = ProfileCategory.TERMINAL): TabInstance {
  const profile = new Profile();
  profile.name = name;
  profile.profileType = ProfileType.LOCAL_TERMINAL;
  const session = new Session(profile, ProfileType.LOCAL_TERMINAL, null as any);
  return new TabInstance(category, session);
}

function createNonsessionTab(): TabInstance {
  const profile = new Profile();
  profile.name = '';
  profile.profileType = ProfileType.LOCAL_TERMINAL;
  const session = new Session(profile, ProfileType.LOCAL_TERMINAL, null as any);
  return new TabInstance(ProfileCategory.TERMINAL, session);
}

describe('TabService', () => {
  let service: TabService;

  beforeEach(() => {
    service = new TabService();
  });

  it('should start with empty tabs', () => {
    expect(service.tabs).toEqual([]);
    expect(service.tabs.length).toBe(0);
  });

  it('should start with default split settings', () => {
    expect(service.splitMode).toBeFalse();
    expect(service.splitRatio).toBe(50);
    expect(service.splitDirection).toBe('vertical');
    expect(service.activePane).toBe(0);
    expect(service.paneTabIndices).toEqual([0, 0]);
  });

  describe('addTab', () => {
    it('should add a tab and assign it to active pane', () => {
      const tab = createTab('Test');
      service.addTab(tab);

      expect(service.tabs.length).toBe(1);
      expect(service.tabs[0].name).toBe('Test');
      expect(service.tabs[0].paneId).toBe(0);
    });

    it('should add tab to the correct pane', () => {
      service.activePane = 1;
      const tab = createTab('Pane 1 Tab');
      service.addTab(tab);

      expect(tab.paneId).toBe(1);
      expect(service.getTabsForPane(1).length).toBe(1);
    });

    it('should deduplicate tab names', () => {
      service.addTab(createTab('Test'));
      service.addTab(createTab('Test'));

      expect(service.tabs.length).toBe(2);
      expect(service.tabs[0].name).toBe('Test');
      expect(service.tabs[1].name).toBe('Test_1');
    });

    it('should increment deduplication suffix correctly', () => {
      service.addTab(createTab('Test'));
      service.addTab(createTab('Test'));
      service.addTab(createTab('Test'));

      expect(service.tabs[2].name).toBe('Test_2');
    });
  });

  describe('getTabsForPane', () => {
    it('should return tabs for the specified pane', () => {
      service.addTab(createTab('Tab 0'));

      service.activePane = 1;
      service.addTab(createTab('Tab 1'));

      expect(service.getTabsForPane(0).length).toBe(1);
      expect(service.getTabsForPane(1).length).toBe(1);
      expect(service.getTabsForPane(0)[0].name).toBe('Tab 0');
      expect(service.getTabsForPane(1)[0].name).toBe('Tab 1');
    });

    it('should return empty array for a pane with no tabs', () => {
      expect(service.getTabsForPane(0)).toEqual([]);
      expect(service.getTabsForPane(99)).toEqual([]);
    });
  });

  describe('removeTab', () => {
    it('should remove a tab by index and pane', () => {
      service.addTab(createTab('A'));
      service.addTab(createTab('B'));

      service.removeTab(0, 0);

      expect(service.tabs.length).toBe(1);
      expect(service.tabs[0].name).toBe('B');
    });

    it('should adjust pane index when removing before selected tab', () => {
      service.addTab(createTab('A'));
      service.addTab(createTab('B'));
      service.paneTabIndices[0] = 1;

      service.removeTab(0, 0);

      expect(service.paneTabIndices[0]).toBe(0);
    });

    it('should not adjust pane index when removing after selected tab', () => {
      service.addTab(createTab('A'));
      service.addTab(createTab('B'));
      service.paneTabIndices[0] = 0;

      service.removeTab(1, 0);

      expect(service.paneTabIndices[0]).toBe(0);
    });

    it('should not adjust pane index when removing the first tab and index is 0', () => {
      service.addTab(createTab('Only'));

      service.removeTab(0, 0);

      expect(service.paneTabIndices[0]).toBe(0);
    });
  });

  describe('removeById', () => {
    it('should remove a tab by id', () => {
      const tab = createTab('Removable');
      service.addTab(tab);
      service.addTab(createTab('Keep'));

      service.removeById(tab.id);

      expect(service.tabs.length).toBe(1);
      expect(service.tabs[0].name).toBe('Keep');
    });

    it('should do nothing if id is not found', () => {
      service.addTab(createTab('A'));
      service.removeById('nonexistent');

      expect(service.tabs.length).toBe(1);
    });
  });

  describe('connected / disconnected', () => {
    it('should mark tab as connected', () => {
      const tab = createTab('Conn');
      service.addTab(tab);

      service.connected(tab.id);

      expect(tab.connected).toBeTrue();
    });

    it('should mark tab as disconnected', () => {
      const tab = createTab('Disc');
      service.addTab(tab);
      tab.connected = true;

      service.disconnected(tab.id);

      expect(tab.connected).toBeFalse();
    });
  });

  describe('getSelectedTab', () => {
    it('should return the selected tab for active pane', () => {
      const tab = createTab('Selected');
      service.addTab(tab);

      const selected = service.getSelectedTab();

      expect(selected).toBe(tab);
    });

    it('should return undefined when no tabs exist', () => {
      expect(service.getSelectedTab()).toBeUndefined();
    });
  });

  describe('toggleSplit', () => {
    it('should enable split mode with default settings', () => {
      service.toggleSplit();

      expect(service.splitMode).toBeTrue();
      expect(service.splitDirection).toBe('vertical');
      expect(service.splitRatio).toBe(50);
    });

    it('should enable split mode with custom settings', () => {
      service.toggleSplit('horizontal', 30);

      expect(service.splitMode).toBeTrue();
      expect(service.splitDirection).toBe('horizontal');
      expect(service.splitRatio).toBe(30);
    });

    it('should change direction when already in split mode', () => {
      service.toggleSplit('vertical');
      service.toggleSplit('horizontal');

      expect(service.splitMode).toBeTrue();
      expect(service.splitDirection).toBe('horizontal');
    });

    it('should toggle off split mode when same settings are provided', () => {
      service.toggleSplit('vertical', 50);
      service.toggleSplit('vertical', 50);

      expect(service.splitMode).toBeFalse();
    });

    it('should reset all tabs to pane 0 when split is disabled', () => {
      const tab0 = createTab('Pane0');
      const tab1 = createTab('Pane1');
      service.addTab(tab0);
      service.activePane = 1;
      service.addTab(tab1);

      service.toggleSplit('vertical', 50);
      service.toggleSplit('vertical', 50);

      expect(tab0.paneId).toBe(0);
      expect(tab1.paneId).toBe(0);
      expect(service.activePane).toBe(0);
    });
  });

  describe('setActivePane', () => {
    it('should change the active pane', () => {
      service.setActivePane(1);
      expect(service.activePane).toBe(1);

      service.setActivePane(0);
      expect(service.activePane).toBe(0);
    });
  });

  describe('moveTabToPane', () => {
    it('should move a tab between panes', () => {
      const tab = createTab('Movable');
      service.addTab(tab);

      service.activePane = 1;
      service.moveTabToPane(tab, 1);

      expect(tab.paneId).toBe(1);
      expect(service.getTabsForPane(0).length).toBe(0);
      expect(service.getTabsForPane(1).length).toBe(1);
    });

    it('should do nothing when moving to the same pane', () => {
      const tab = createTab('Stay');
      service.addTab(tab);

      service.moveTabToPane(tab, 0);

      expect(tab.paneId).toBe(0);
      expect(service.tabs.length).toBe(1);
    });

    it('should adjust source pane index when moving from before selected tab', () => {
      service.addTab(createTab('A'));
      const tab = createTab('B');
      service.addTab(tab);
      service.paneTabIndices[0] = 1;

      service.moveTabToPane(tab, 1);

      expect(service.paneTabIndices[0]).toBe(0);
    });
  });

  describe('nonsession tab naming', () => {
    it('should use profileType when profile has no name', () => {
      const tab = createNonsessionTab();
      expect(tab.name).toBe('LOCAL_TERMINAL');
    });
  });
});
