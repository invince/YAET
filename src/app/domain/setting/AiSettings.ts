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

  // P1-1: guards the LLM HTTP call only (tool execution has its own timeouts).
  requestTimeoutMs: number = 120000;

  // P1-1C: whole-run context budget (est. tokens, len/4). Depth cap stops LONG
  // runs; this stops FAT ones (huge tool outputs blowing the model window).
  maxLoopTokens: number = 100000;

  downloadDir: string = '';

  contextOptimization: ContextOptimization = {
    enabled: true,
    level: 2,
    idleSummary: true,
    maxContextTokens: 4000,
  };
}
