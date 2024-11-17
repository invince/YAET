export class TabCategory {
  constructor(private value: string) {
  }


  get(): string {
    return this.value;
  }
}

export const TERMINAL = new TabCategory("TERMINAL");
export const REMOTE_DESKTOP = new TabCategory("REMOTE_DESKTOP");
export const FILE_EXPLORER = new TabCategory("FILE_EXPLORER");

