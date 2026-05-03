const TOKEN_ESTIMATES: Record<string, number> = {
  'gpt-4o': 1.0,
  'gpt-4o-mini': 1.0,
  'gpt-5': 1.0,
  'o3': 1.0,
  'claude-4-opus': 1.0,
  'claude-4-sonnet': 1.0,
  'claude-3.5-haiku': 1.0,
  'gemini-2.5-pro': 0.8,
  'gemini-2.5-flash': 0.8,
  'gemini-2.0-flash': 0.8,
  'grok-4': 1.0,
  'grok-3': 1.0,
  'grok-2': 1.0,
  'deepseek-v3': 0.9,
  'deepseek-r1': 0.9,
  'deepseek-coder': 0.9,
  'llama-4-maverick': 0.8,
  'llama-4-scout': 0.8,
  'llama-3.3-70b': 0.8,
  'mistral-large': 1.0,
  'mistral-medium': 1.0,
  'mistral-small': 1.0,
  'codestral': 1.0,
  'command-r-plus': 0.9,
  'command-r': 0.9,
  'command': 0.9,
  'mixtral-8x7b': 0.8,
  'deepseek-r1-distill': 0.8,
  'sonar-pro': 1.0,
  'sonar': 1.0,
  'pplx-70b-online': 1.0,
  'llama-v3-70b': 0.8,
  'mixtral-8x22b': 0.8,
  'llama4-maverick-17b': 0.8,
  'llama3.1-70b': 0.8,
  'local-model': 0.7,
};

export function estimateTokens(text: string, model?: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const avgCharsPerWord = words.length > 0
    ? words.reduce((sum, w) => sum + w.length, 0) / words.length
    : 0;

  let tokenEstimate = wordCount * 1.3;

  if (avgCharsPerWord > 8) {
    tokenEstimate *= 1.2;
  }

  const factor = model ? (TOKEN_ESTIMATES[model] || 1.0) : 1.0;
  tokenEstimate *= factor;

  return Math.ceil(tokenEstimate);
}

export function estimateMessageTokens(
  messages: { role: string; content: string }[],
  model?: string,
): number {
  let total = 0;
  for (const msg of messages) {
    total += 4;
    total += estimateTokens(msg.content, model);
    total += estimateTokens(msg.role, model);
  }
  total += 2;
  return total;
}

export function isWithinTokenLimit(
  messages: { role: string; content: string }[],
  limit: number,
  model?: string,
): boolean {
  return estimateMessageTokens(messages, model) < limit;
}

export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-5': 200000,
  'o3': 200000,
  'claude-4-opus': 200000,
  'claude-4-sonnet': 200000,
  'claude-3.5-haiku': 200000,
  'gemini-2.5-pro': 1000000,
  'gemini-2.5-flash': 1000000,
  'gemini-2.0-flash': 1000000,
  'grok-4': 1000000,
  'grok-3': 131072,
  'grok-2': 131072,
  'deepseek-v3': 65536,
  'deepseek-r1': 65536,
  'deepseek-coder': 65536,
  'llama-4-maverick': 131072,
  'llama-4-scout': 131072,
  'llama-3.3-70b': 128000,
  'mistral-large': 131072,
  'mistral-medium': 32768,
  'mistral-small': 32768,
  'codestral': 32768,
  'command-r-plus': 128000,
  'command-r': 128000,
  'command': 4096,
  'mixtral-8x7b': 32768,
  'sonar-pro': 131072,
  'sonar': 131072,
  'pplx-70b-online': 4096,
  'llama-v3-70b': 32768,
  'mixtral-8x22b': 65536,
  'llama4-maverick-17b': 128000,
  'llama3.1-70b': 128000,
  'local-model': 131072,
};
