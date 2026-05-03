import { AIProvider, AI_PROVIDERS } from '../../types';
import type { AIProviderBase } from '../ai-provider';

export interface FallbackConfig {
  primary: AIProvider;
  fallbacks: AIProvider[];
  timeout: number;
}

const defaultFallbacks: Record<AIProvider, AIProvider[]> = {
  openai: ['deepseek', 'groq', 'local'],
  claude: ['openai', 'gemini', 'local'],
  gemini: ['deepseek', 'openai', 'local'],
  xai: ['openai', 'deepseek', 'local'],
  deepseek: ['openai', 'groq', 'local'],
  mistral: ['openai', 'deepseek', 'local'],
  groq: ['deepseek', 'openai', 'local'],
  meta: ['groq', 'openai', 'local'],
  cohere: ['openai', 'deepseek', 'local'],
  together: ['openai', 'groq', 'local'],
  perplexity: ['openai', 'deepseek', 'local'],
  fireworks: ['openai', 'groq', 'local'],
  cerebras: ['openai', 'deepseek', 'local'],
  replicate: ['openai', 'deepseek', 'local'],
  local: [],
};

export function getFallbackChain(primary: AIProvider): FallbackConfig {
  return {
    primary,
    fallbacks: defaultFallbacks[primary] || ['openai', 'deepseek', 'local'],
    timeout: 15000,
  };
}

export interface FallbackResult<T> {
  result: T;
  provider: AIProvider;
  attempts: string[];
}

export async function executeWithFallback<T>(
  primary: AIProvider,
  factory: (providerKey: AIProvider) => AIProviderBase,
  action: (provider: AIProviderBase) => Promise<T>,
  timeout?: number,
): Promise<FallbackResult<T>> {
  const chain = getFallbackChain(primary);
  const providers = [chain.primary, ...chain.fallbacks];
  const attempts: string[] = [];

  for (const key of providers) {
    const info = AI_PROVIDERS[key];
    if (!info) continue;

    const envKey = info.envKey;
    if (envKey && !process.env[envKey]) {
      attempts.push(`${key}:no-key`);
      continue;
    }

    try {
      const provider = factory(key);
      const result = await withTimeout(
        action(provider),
        timeout || chain.timeout,
      );
      return { result, provider: key, attempts };
    } catch (error: unknown) {
      const err = error as Error;
      attempts.push(`${key}:${err.message?.slice(0, 40) || 'unknown'}`);

      if (key === 'local') {
        throw new Error(
          `All AI providers failed. Attempts: ${attempts.join(', ')}`,
        );
      }
    }
  }

  throw new Error(
    `All AI providers failed. Attempts: ${attempts.join(', ')}`,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
