import {v4 as uuidv4} from 'uuid';
export class Secret {

  id: string = uuidv4();
  name!: string;
  user!: string;
  pass!: string;

  key!: string;
}
