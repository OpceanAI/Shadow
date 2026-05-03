import { AIProvider, AIExplanation, FixProposal, ProjectInfo, FileInfo, AI_PROVIDERS } from '../types';
import { ShadowConfig } from '../types';
import { AIProviderBase, AIReview, ChatRequest } from './ai/base';
import { OpenAICompatProvider, ClaudeProvider, GeminiProvider, CohereProvider, ReplicateProvider, LocalProvider } from './ai/providers';
import { executeWithFallback } from './ai/fallback';
import * as fs from 'fs';

// ─── Re-exports ──────────────────────────────────────────────────────────────

export { AIProviderBase, AIReview, ChatRequest } from './ai/base';
export { OpenAICompatProvider, ClaudeProvider, GeminiProvider, CohereProvider, ReplicateProvider, LocalProvider } from './ai/providers';

// ─── Provider Factory ────────────────────────────────────────────────────────

export function createAIProvider(key: AIProvider): AIProviderBase {
  switch (key) {
    case 'openai': case 'xai': case 'deepseek': case 'mistral': case 'groq':
    case 'together': case 'perplexity': case 'fireworks': case 'cerebras': case 'meta':
      return new OpenAICompatProvider(key);
    case 'claude': return new ClaudeProvider();
    case 'gemini': return new GeminiProvider();
    case 'cohere': return new CohereProvider();
    case 'replicate': return new ReplicateProvider();
    case 'local': default: return new LocalProvider();
  }
}

// ─── AIProviderService ───────────────────────────────────────────────────────

export class AIProviderService {
  private provider: AIProviderBase;
  private providerKey: AIProvider;
  private config: ShadowConfig;

  constructor(config: ShadowConfig) {
    this.config = config;
    this.providerKey = config.aiProvider || 'local';
    this.provider = createAIProvider(this.providerKey);
  }

  get providerInfo() { return AI_PROVIDERS[this.providerKey]; }

  hasApiKey(): boolean {
    const envKey = AI_PROVIDERS[this.providerKey].envKey;
    if (!envKey) return true;
    return !!process.env[envKey];
  }

  async explainFile(filePath: string, fileInfo: FileInfo): Promise<AIExplanation> {
    let code = '';
    try { code = fs.readFileSync(filePath, 'utf-8'); } catch { code = fileInfo.path; }
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.explainCode(code, fileInfo.language)).then((r) => r.result);
    } catch {
      return { summary: `${fileInfo.language} file with ${fileInfo.functions.length} functions and ${fileInfo.classes.length} classes.`, details: [], bugs: [], refactors: [], confidence: 0.7 };
    }
  }

  async summarizeProject(project: ProjectInfo): Promise<string> {
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.summarizeProject(project)).then((r) => r.result);
    } catch {
      return `${project.name} is a ${project.language} project with ${project.totalFiles} files. ${project.summary}`;
    }
  }

  async suggestFix(issue: string, filePath?: string): Promise<FixProposal> {
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.suggestFix(issue, issue)).then((r) => r.result);
    } catch {
      return { title: `Fix: ${issue}`, description: `Proposed fix for: ${issue}`, file: filePath || '', patch: '', risk: 'low' };
    }
  }

  async identifyBugs(fileInfo: FileInfo): Promise<string[]> {
    const bugs: string[] = [];
    if (fileInfo.envVars.length > 0) bugs.push('Contains environment variable usage - ensure these are set');
    return bugs;
  }

  async generateTests(code: string): Promise<string> {
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.generateTests(code)).then((r) => r.result);
    } catch { return '// Could not generate tests'; }
  }

  async reviewCode(diff: string): Promise<AIReview> {
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.reviewCode(diff)).then((r) => r.result);
    } catch { return { summary: 'Code review unavailable', issues: [], suggestions: [], score: 0 }; }
  }

  async chat(request: ChatRequest): Promise<string> {
    try {
      return await executeWithFallback(this.providerKey, createAIProvider, async (p) => p.chat(request)).then((r) => r.result);
    } catch { return `Unable to process chat. Provider ${this.providerKey} is not available.`; }
  }
}

// ─── Named Thin Wrappers ─────────────────────────────────────────────────────

export class OpenAIProvider extends OpenAICompatProvider { constructor() { super('openai'); } }
export class XAIProvider extends OpenAICompatProvider { constructor() { super('xai'); } }
export class DeepSeekProvider extends OpenAICompatProvider { constructor() { super('deepseek'); } }
export class MistralProvider extends OpenAICompatProvider { constructor() { super('mistral'); } }
export class GroqProvider extends OpenAICompatProvider { constructor() { super('groq'); } }
export class TogetherProvider extends OpenAICompatProvider { constructor() { super('together'); } }
export class PerplexityProvider extends OpenAICompatProvider { constructor() { super('perplexity'); } }
export class FireworksProvider extends OpenAICompatProvider { constructor() { super('fireworks'); } }
export class CerebrasProvider extends OpenAICompatProvider { constructor() { super('cerebras'); } }
export class MetaProvider extends OpenAICompatProvider { constructor() { super('meta'); } }
