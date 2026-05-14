import {GroupNode, NODE_DEFAULT_NAME} from './GroupNode';
import {Group} from './Group';
import {Profile, ProfileType} from './profile/Profile';

describe('GroupNode', () => {
  describe('map2DataSource', () => {
    const groups = [
      { id: 'grp-1', name: 'Servers', color: '#ff0000' } as Group,
      { id: 'grp-2', name: 'Workstations', color: '#00ff00' } as Group,
    ];

    const profiles = [
      { id: 'p-1', name: 'Web Server', group: 'grp-1', profileType: ProfileType.SSH_TERMINAL } as Profile,
      { id: 'p-2', name: 'DB Server', group: 'grp-1', profileType: ProfileType.SSH_TERMINAL } as Profile,
      { id: 'p-3', name: 'Dev Machine', group: 'grp-2', profileType: ProfileType.LOCAL_TERMINAL } as Profile,
    ];

    it('should return empty array when groups is undefined', () => {
      const result = GroupNode.map2DataSource(undefined, []);
      expect(result).toEqual([]);
    });

    it('should group profiles under their group nodes', () => {
      const result = GroupNode.map2DataSource(groups, profiles, false);
      expect(result.length).toBe(2);

      const servers = result.find(n => n.id === 'grp-1');
      expect(servers).toBeTruthy();
      expect(servers!.children?.length).toBe(2);
      // Sorted alphabetically by name: 'DB Server' < 'Web Server'
      expect(servers!.children![0].id).toBe('p-2');
      expect(servers!.children![1].id).toBe('p-1');

      const workstations = result.find(n => n.id === 'grp-2');
      expect(workstations).toBeTruthy();
      expect(workstations!.children?.length).toBe(1);
      expect(workstations!.children![0].id).toBe('p-3');
    });

    it('should sort groups alphabetically', () => {
      const result = GroupNode.map2DataSource(groups, profiles, false);
      expect(result[0].name).toBe('Servers');
      expect(result[1].name).toBe('Workstations');
    });

    it('should include empty groups when showEmptyGroup is true', () => {
      const emptyGroup = { id: 'grp-3', name: 'Empty Group', color: '#0000ff' } as Group;
      const result = GroupNode.map2DataSource([...groups, emptyGroup], profiles, true);
      expect(result.length).toBe(3);
      const empty = result.find(n => n.id === 'grp-3');
      expect(empty).toBeTruthy();
    });

    it('should exclude empty groups when showEmptyGroup is false', () => {
      const emptyGroup = { id: 'grp-3', name: 'Empty Group', color: '#0000ff' } as Group;
      const result = GroupNode.map2DataSource([...groups, emptyGroup], profiles, false);
      expect(result.length).toBe(2);
    });

    it('should create a default node for profiles without group', () => {
      const ungrouped = [
        { id: 'p-4', name: 'Ungrouped Profile', group: '', profileType: ProfileType.LOCAL_TERMINAL } as Profile,
      ];
      const result = GroupNode.map2DataSource(groups, [...profiles, ...ungrouped], false, true);
      const defaultNode = result.find(n => n.name === NODE_DEFAULT_NAME);
      expect(defaultNode).toBeTruthy();
      expect(defaultNode!.children?.length).toBe(1);
      expect(defaultNode!.children![0].id).toBe('p-4');
    });

    it('should not create default node when showDefault is false', () => {
      const ungrouped = [
        { id: 'p-4', name: 'Ungrouped', group: '', profileType: ProfileType.LOCAL_TERMINAL } as Profile,
      ];
      const result = GroupNode.map2DataSource(groups, [...profiles, ...ungrouped], false, false);
      const defaultNode = result.find(n => n.name === NODE_DEFAULT_NAME);
      expect(defaultNode).toBeUndefined();
    });

    it('should apply patch functions', () => {
      const result = GroupNode.map2DataSource(
        groups, profiles, false, false,
        (group, node) => { node.editable = true; return node; },
        (profile, node) => { node.editable = true; return node; },
      );
      expect(result[0].editable).toBeTrue();
      expect(result[0].children![0].editable).toBeTrue();
    });
  });

  describe('sortChild', () => {
    it('should sort children alphabetically', () => {
      const parent = new GroupNode();
      parent.name = 'Parent';
      parent.children = [
        { name: 'Zebra' } as GroupNode,
        { name: 'Alpha' } as GroupNode,
        { name: 'Beta' } as GroupNode,
      ];

      const result = GroupNode['sortChild']([parent], (a, b) => a.name.localeCompare(b.name));
      expect(result[0].children![0].name).toBe('Alpha');
      expect(result[0].children![1].name).toBe('Beta');
      expect(result[0].children![2].name).toBe('Zebra');
    });
  });
});
