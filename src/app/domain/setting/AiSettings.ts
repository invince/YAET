export type AiMode = 'web' | 'acp';

export interface ContextOptimization {
  enabled: boolean;
  level: number;
  idleSummary: boolean;
  maxContextTokens: number;
}

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
  crossSessionAccess: boolean = false;

  contextOptimization: ContextOptimization = {
    enabled: true,
    level: 2,
    idleSummary: true,
    maxContextTokens: 4000,
  };
}
