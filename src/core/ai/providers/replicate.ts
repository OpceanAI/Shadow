import { AIExplanation, FixProposal, ProjectInfo } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';

export class ReplicateProvider extends AIProviderBase {
  constructor() { super('replicate'); }

  private async predictions(
    messages: { role: string; content: string }[],
    temperature: number = 0.3, maxTokens: number = 2000,
  ): Promise<string> {
    const cacheKey = JSON.stringify({ provider: 'replicate', messages, temperature, maxTokens });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as string;

    try {
      const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      const response = await this.httpClient.post(this.apiUrl, {
        version: this.model,
        input: { prompt, temperature, max_tokens: maxTokens, system_prompt: messages.find((m) => m.role === 'system')?.content || '' },
      }, { 'Authorization': `Bearer ${this.apiKey}` });

      const data = JSON.parse(response.body);
      const result = await this.pollPrediction(data.id);
      this.cache.set(cacheKey, result);
      return result;
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  private async pollPrediction(id: string): Promise<string> {
    const pollUrl = `https://api.replicate.com/v1/predictions/${id}`;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const response = await this.httpClient.get(pollUrl, { 'Authorization': `Bearer ${this.apiKey}` });
      const data = JSON.parse(response.body);
      if (data.status === 'succeeded') {
        const output = data.output;
        if (Array.isArray(output) && output.length > 0) return output.join('');
        return typeof output === 'string' ? output : JSON.stringify(output);
      }
      if (data.status === 'failed' || data.status === 'canceled') {
        throw new Error(`Replicate prediction ${data.status}: ${data.error || 'unknown'}`);
      }
    }
    throw new Error('Replicate prediction timed out');
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const t = getPromptTemplate('explain', code, language);
    return this.predictions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseExplanation(r));
  }
  async summarizeProject(info: ProjectInfo): Promise<string> {
    return this.predictions([{ role: 'user', content: `Summarize:\n${JSON.stringify({ name: info.name, language: info.language, files: info.totalFiles })}` }], 0.3, 500).then((r) => r.trim());
  }
  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const t = getPromptTemplate('fix', code, 'unknown', issue);
    return this.predictions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseFixProposal(r, ''));
  }
  async generateTests(code: string): Promise<string> {
    const t = getPromptTemplate('test', code, 'unknown');
    return this.predictions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
  }
  async reviewCode(diff: string): Promise<AIReview> {
    const t = getPromptTemplate('review', diff, 'unknown');
    const r = await this.predictions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return { summary: r.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }
  async chat(request: ChatRequest): Promise<string> {
    return this.predictions(request.messages, request.temperature || 0.5, request.maxTokens || 2000);
  }
}
