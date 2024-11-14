export class TabInstance {

  readonly id: number;

  readonly type: string;

  constructor(index: number, type: string) {
    this.id = index;
    this.type = type;
  }


}
