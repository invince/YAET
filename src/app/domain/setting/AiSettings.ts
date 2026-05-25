export type AiMode = 'web' | 'acp';

export class AiSettings {
  mode: AiMode = 'web';

  apiUrl: string = 'https://api.openai.com/v1';
  token: string = '';
  model: string = '';

  acpCommand: string = '';
  acpArgs: string = '';
  acpModel: string = '';

  useContext: boolean = true;
  agentMode: boolean = false;
  contextMaxLines: number = 50;
}
