import {v4 as uuidv4} from 'uuid';

export class Tag {
  readonly id: string = uuidv4(); // uuid

  public name: string = '';
  public color: string = '';

  constructor(name: string) {
    this.name = name;
  }

}
