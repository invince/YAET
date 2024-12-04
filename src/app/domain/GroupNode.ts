import {Group} from './Group';
import {Profile} from './Profile';

export class GroupNode {
  name? : string;

  oldName? : string;

  id? : string;

  editable: boolean = false;
  level: number = 0;
  expandable: boolean = false;

  color: string = '';

  group?: Group;
  profile?: Profile;

  isNew: boolean = false;

  children?: GroupNode[];


  public static map2DataSource(
    allGroups: Group[] | undefined, allProfiles: Profile[] | undefined,
    showEmptyGroup: boolean = true,
    showDefault: boolean = false,
    patchGroup: (group: Group, node: GroupNode) => GroupNode = (group, node) => node,
    patchProfile: (profile: Profile, node: GroupNode) => GroupNode = (profile, node) => node,
  ): GroupNode[]{

    if (!allGroups) {
      return [];
    }

    let result: GroupNode[] = [];
    const groupIdProfileMap = new Map<string, Profile[]>();
    const groupIdGroupMap = new Map<string, Group>();

    const groupIdNodeMap = new Map<string, GroupNode>();

    let profilesWithoutGrp: Profile[] = [];

    allGroups.forEach(oneGrp => {
      if (oneGrp && oneGrp.id) {
        groupIdGroupMap.set(oneGrp.id, oneGrp);
      }
    });

    if (allProfiles) {
      allProfiles.forEach(profile => {
        const groupId = profile.group; // Get the group for the current profile
        if (groupId) {
          if (!groupIdProfileMap.has(groupId)) {
            groupIdProfileMap.set(groupId, []);
          }
          groupIdProfileMap.get(groupId)?.push(profile);
        } else {
          profilesWithoutGrp.push(profile);
        }
      });
    }

    // construct a map of grpId and Node(with children)
    groupIdProfileMap.forEach((profilesInThisGrp, groupId) => {
      let oneGroup = groupIdGroupMap.get(groupId);
      if (!oneGroup) {
        profilesWithoutGrp = [...profilesWithoutGrp, ...profilesInThisGrp];
      } else {
        let node = this.mapGroup2Node(oneGroup);
        if (patchGroup) {
          node = patchGroup(oneGroup, node);
        }
        for (let oneProfile of profilesInThisGrp) {
          let childNode = this.mapProfile2Node(oneProfile)
          if (patchProfile) {
            childNode = patchProfile(oneProfile, childNode);
          }
          node.addChild(childNode);
        }
        groupIdNodeMap.set(groupId, node);
      }
    });

    for (const oneGroup of allGroups) {
      if (oneGroup && oneGroup.id) {
        let node = groupIdNodeMap.get(oneGroup.id);
        if (node) {
          result.push(node);
        } else if (showEmptyGroup) {
          let node = this.mapGroup2Node(oneGroup);
          if (patchGroup) {
            node = patchGroup(oneGroup, node);
          }
          result.push(node)
        }
      }
    }

    if (showDefault && profilesWithoutGrp && profilesWithoutGrp.length > 0) {
      let defaultNode = new GroupNode();
      defaultNode.name = 'default';
      defaultNode.children = [];
      for (let oneProfile of profilesWithoutGrp) {
        let childNode = this.mapProfile2Node(oneProfile)
        if (patchProfile) {
          childNode = patchProfile(oneProfile, childNode);
        }
        defaultNode.addChild(childNode);
      }
      result.push(defaultNode);
    }
    return result;
  }

  private static mapGroup2Node(oneGroup: Group): GroupNode {
    const  node = new GroupNode();
    node.name = oneGroup.name;
    node.id = oneGroup.id;
    node.group = oneGroup;
    node.color = oneGroup.color;
    node.children = [];
    return node;
  }

  private static mapProfile2Node(oneProfile: Profile) : GroupNode {
    const childNode = new GroupNode();
    childNode.name = oneProfile.name;
    childNode.oldName = oneProfile.name;
    childNode.id = oneProfile.id;
    childNode.isNew = oneProfile.isNew;
    childNode.profile = oneProfile;
    return childNode;
  }

  private addChild(groupNode: GroupNode) {
    if(!this.children) {
      this.children = [];
    }
    if (groupNode) {
      this.children.push(groupNode);
    }

  }
}
