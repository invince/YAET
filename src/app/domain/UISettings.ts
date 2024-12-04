export class UISettings {

  public profileLabelLength: number = 10;

  public profileSideNavType: SideNavType = SideNavType.FLAT;
  public secretLabelLength: number = 10;

}


export enum SideNavType {
  FLAT = 'flat',
  TREE = 'tree',
}
