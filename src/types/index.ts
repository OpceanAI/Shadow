export type SupportedLanguage =
  | 'python'
  | 'typescript'
  | 'javascript'
  | 'rust'
  | 'go'
  | 'shell'
  | 'java'
  | 'cpp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'elixir'
  | 'haskell'
  | 'sql'
  | 'yaml'
  | 'dockerfile'
  | 'terraform'
  | 'markdown'
  | 'unknown';

export type OutputFormat = 'human' | 'short' | 'json' | 'graph' | 'patch' | 'md';

export type AIProvider =
  | 'openai'
  | 'claude'
  | 'gemini'
  | 'xai'
  | 'deepseek'
  | 'mistral'
  | 'groq'
  | 'meta'
  | 'cohere'
  | 'together'
  | 'perplexity'
  | 'fireworks'
  | 'cerebras'
  | 'replicate'
  | 'local';

export const AI_PROVIDERS: Record<AIProvider, {
  name: string;
  models: string[];
  envKey: string;
  baseUrl: string;
  apiUrl: string;
}> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-5', 'gpt-4o', 'o3', 'gpt-4o-mini'],
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
  },
  claude: {
    name: 'Anthropic Claude',
    models: ['claude-4-opus', 'claude-4-sonnet', 'claude-3.5-haiku'],
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    apiUrl: 'https://api.anthropic.com/v1/messages',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    envKey: 'GOOGLE_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  },
  xai: {
    name: 'xAI Grok',
    models: ['grok-4', 'grok-3', 'grok-2'],
    envKey: 'XAI_API_KEY',
    baseUrl: 'https://api.x.ai/v1',
    apiUrl: 'https://api.x.ai/v1/chat/completions',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-v3', 'deepseek-r1', 'deepseek-coder'],
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
  },
  mistral: {
    name: 'Mistral AI',
    models: ['mistral-large', 'mistral-medium', 'mistral-small', 'codestral'],
    envKey: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    apiUrl: 'https://api.mistral.ai/v1/chat/completions',
  },
  groq: {
    name: 'Groq',
    models: ['llama-4-maverick', 'mixtral-8x7b', 'deepseek-r1-distill'],
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
  },
  meta: {
    name: 'Meta Llama',
    models: ['llama-4-maverick', 'llama-4-scout', 'llama-3.3-70b'],
    envKey: 'META_API_KEY',
    baseUrl: 'https://api.llama-api.com',
    apiUrl: 'https://api.llama-api.com/chat/completions',
  },
  cohere: {
    name: 'Cohere',
    models: ['command-r-plus', 'command-r', 'command'],
    envKey: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.ai/v2',
    apiUrl: 'https://api.cohere.ai/v2/chat',
  },
  together: {
    name: 'Together AI',
    models: ['meta-llama/Llama-4-Maverick-17B', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen3-235B'],
    envKey: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    apiUrl: 'https://api.together.xyz/v1/chat/completions',
  },
  perplexity: {
    name: 'Perplexity AI',
    models: ['sonar-pro', 'sonar', 'pplx-70b-online'],
    envKey: 'PERPLEXITY_API_KEY',
    baseUrl: 'https://api.perplexity.ai',
    apiUrl: 'https://api.perplexity.ai/chat/completions',
  },
  fireworks: {
    name: 'Fireworks AI',
    models: ['llama-v3-70b', 'mixtral-8x22b', 'deepseek-v3'],
    envKey: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
  },
  cerebras: {
    name: 'Cerebras',
    models: ['llama4-maverick-17b', 'llama3.1-70b'],
    envKey: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiUrl: 'https://api.cerebras.ai/v1/chat/completions',
  },
  replicate: {
    name: 'Replicate',
    models: ['meta/llama-4-maverick', 'mistralai/mistral-large'],
    envKey: 'REPLICATE_API_KEY',
    baseUrl: 'https://api.replicate.com/v1',
    apiUrl: 'https://api.replicate.com/v1/predictions',
  },
  local: {
    name: 'Local (Ollama / LM Studio)',
    models: ['local-model'],
    envKey: '',
    baseUrl: 'http://localhost:11434',
    apiUrl: 'http://localhost:11434/api/chat',
  },
};

export type DeployTarget = 'docker' | 'vercel' | 'fly' | 'k8s';

export type TraceDomain = 'network' | 'fs' | 'env' | 'spawn' | 'all';

export interface ShadowConfig {
  aiProvider?: AIProvider;
  outputStyle?: OutputFormat;
  cacheEnabled?: boolean;
  cacheDir?: string;
  cacheMaxSize?: number;
  parallelWorkers?: number;
  batchSize?: number;
  watchDebounceMs?: number;
  maxMemoryMB?: number;
  theme?: 'dark' | 'light' | 'minimal' | 'neon';
  emoji?: boolean;
  verbose?: boolean;
  privacy?: PrivacySettings;
  tracingDepth?: number;
  testGeneration?: TestGenSettings;
  deploymentChecks?: DeployCheckSettings;
  ignoredPaths?: string[];
  entryPoints?: string[];
  plugins?: Record<string, PluginConfig>;
  aliases?: Record<string, string>;
  profiles?: Record<string, Partial<ShadowConfig>>;
  activeProfile?: string;
}

export interface PluginConfig {
  enabled?: boolean;
  settings?: Record<string, unknown>;
}

export interface PrivacySettings {
  maskSecrets: boolean;
  noNetwork: boolean;
  allowCloudAI: boolean;
}

export interface TestGenSettings {
  fuzzCount: number;
  includeSecurity: boolean;
  excludePaths: string[];
}

export interface DeployCheckSettings {
  requiredEnvVars: string[];
  buildCommand: string;
  smokeTestCommand: string;
}

export interface ImportInfo {
  name: string;
  type: 'internal' | 'external';
  path?: string;
}

export interface FileInfo {
  path: string;
  language: SupportedLanguage;
  purpose: string;
  imports: ImportInfo[];
  exports: string[];
  functions: string[];
  classes: string[];
  envVars: string[];
  externalCalls: string[];
  dependencies: string[];
}

export interface ProjectInfo {
  name: string;
  rootPath: string;
  language: SupportedLanguage;
  summary: string;
  files: FileInfo[];
  entryPoints: string[];
  envVars: string[];
  externalAPIs: string[];
  totalFiles: number;
  graph: DependencyGraph;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  path: string;
  type: 'file' | 'function' | 'class' | 'env' | 'external';
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'references' | 'reads_env' | 'network';
}

export interface TraceEvent {
  timestamp: number;
  type: TraceDomain;
  detail: string;
  path?: string;
  value?: string;
  masked?: boolean;
}

export interface TraceResult {
  events: TraceEvent[];
  duration: number;
  exitCode: number | null;
  errors: string[];
}

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  failures: TestFailure[];
  coverage?: number;
}

export interface TestFailure {
  name: string;
  error: string;
  file: string;
  line: number;
}

export interface FixProposal {
  title: string;
  description: string;
  file: string;
  patch: string;
  risk: 'low' | 'medium' | 'high';
}

export interface DiffSummary {
  from: string;
  to: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  behavioralChanges: string[];
  regressionRisks: string[];
  areasToRetest: string[];
}

export interface DeployReport {
  target: DeployTarget;
  passed: boolean;
  checks: DeployCheck[];
}

export interface DeployCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

export interface AIExplanation {
  summary: string;
  details: string[];
  bugs?: string[];
  refactors?: string[];
  confidence: number;
}
