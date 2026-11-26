export class UISettings {

  public profileLabelLength: number = 10;

  public profileSideNavType: SideNavType = SideNavType.FLAT;
  public secretLabelLength: number = 10;
  public secretLabelLengthInDropDown: number = 8;

  public theme: string = 'pink-bluegrey';

  /** Show live SSH CPU/RAM/disk metrics in the bottom bar (opt-in). */
  public showSshMetrics: boolean = false;
}


export enum SideNavType {
  FLAT = 'flat',
  TREE = 'tree',
}
