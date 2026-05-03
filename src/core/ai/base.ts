import { AIProvider, AIExplanation, FixProposal, ProjectInfo, FileInfo, AI_PROVIDERS } from '../../types';
import { HttpClient, sharedClient } from './http-client';
import { AICache, globalCache } from './cache';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIReview {
  summary: string;
  issues: { severity: 'error' | 'warning' | 'info'; file: string; line?: number; message: string }[];
  suggestions: string[];
  score: number;
}

export interface ChatRequest {
  messages: { role: string; content: string }[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

// ─── Abstract Base ──────────────────────────────────────────────────────────

export abstract class AIProviderBase {
  protected httpClient: HttpClient;
  protected cache: AICache;
  protected apiKey: string;
  protected apiUrl: string;
  providerKey: AIProvider;
  protected model: string;

  constructor(providerKey: AIProvider) {
    const info = AI_PROVIDERS[providerKey];
    this.httpClient = sharedClient;
    this.cache = globalCache;
    this.providerKey = providerKey;
    this.apiUrl = info.apiUrl;
    this.apiKey = info.envKey ? process.env[info.envKey] || '' : '';
    this.model = info.models[0];
  }

  abstract explainCode(code: string, language: string): Promise<AIExplanation>;
  abstract summarizeProject(info: ProjectInfo): Promise<string>;
  abstract suggestFix(code: string, issue: string): Promise<FixProposal>;
  abstract generateTests(code: string): Promise<string>;
  abstract reviewCode(diff: string): Promise<AIReview>;
  abstract chat(request: ChatRequest): Promise<string>;

  protected log(operation: string, message: string): void {
    if (process.env.SHADOW_DEBUG) {
      console.error(`[${this.providerKey}] ${operation}: ${message}`);
    }
  }

  protected parseExplanation(response: string): AIExplanation {
    const summaryMatch = response.match(/## Summary\n([\s\S]*?)(?=\n##|$)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : response.slice(0, 200);

    const details: string[] = [];
    const bugSection = response.match(/## Potential Issues\n([\s\S]*?)(?=\n##|$)/);
    if (bugSection) {
      details.push(...bugSection[1].split('\n').filter((l) => l.trim()).map((l) => l.replace(/^[-*]\s*/, '').trim()));
    }

    const suggestionSection = response.match(/## Suggestions\n([\s\S]*?)(?=\n##|$)/);
    if (suggestionSection) {
      suggestionSection[1].split('\n')
        .filter((l) => l.trim())
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .forEach((s) => details.push(`Suggestion: ${s}`));
    }

    return { summary, details, bugs: [], refactors: [], confidence: 0.85 };
  }

  protected parseFixProposal(response: string, file: string): FixProposal {
    const titleMatch = response.match(/^#+\s*(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Fix proposal';

    const patchMatch = response.match(/```diff\n([\s\S]*?)```/);
    const patch = patchMatch ? patchMatch[1].trim() : response;

    const description = response.replace(/```[\s\S]*?```/g, '').trim();

    let risk: 'low' | 'medium' | 'high' = 'medium';
    if (/risk:\s*(low|medium|high)/i.test(response)) {
      const m = response.match(/risk:\s*(low|medium|high)/i);
      if (m) risk = m[1].toLowerCase() as 'low' | 'medium' | 'high';
    }

    return { title, description, file, patch, risk };
  }
}
