import { AIProvider, AIExplanation, FixProposal, ProjectInfo } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';

export class ClaudeProvider extends AIProviderBase {
  constructor() { super('claude'); }

  private async messagesAPI(
    messages: { role: string; content: string }[],
    temperature: number = 0.3,
    maxTokens: number = 2000,
  ): Promise<string> {
    const cacheKey = JSON.stringify({ provider: 'claude', messages, temperature, maxTokens });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as string;

    try {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const chatMessages = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));

      const response = await this.httpClient.post(this.apiUrl, {
        model: this.model, system, messages: chatMessages, max_tokens: maxTokens, temperature,
      }, { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01' });

      const data = JSON.parse(response.body);
      const text = data.content?.[0]?.text || '';
      this.cache.set(cacheKey, text);
      return text;
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const t = getPromptTemplate('explain', code, language);
    const r = await this.messagesAPI([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return this.parseExplanation(r);
  }
  async summarizeProject(info: ProjectInfo): Promise<string> {
    const r = await this.messagesAPI([{ role: 'user', content: `Summarize:\n${JSON.stringify({ name: info.name, language: info.language, files: info.totalFiles })}` }], 0.3, 500);
    return r.trim();
  }
  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const t = getPromptTemplate('fix', code, 'unknown', issue);
    const r = await this.messagesAPI([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return this.parseFixProposal(r, '');
  }
  async generateTests(code: string): Promise<string> {
    const t = getPromptTemplate('test', code, 'unknown');
    return this.messagesAPI([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
  }
  async reviewCode(diff: string): Promise<AIReview> {
    const t = getPromptTemplate('review', diff, 'unknown');
    const r = await this.messagesAPI([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return { summary: r.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }
  async chat(request: ChatRequest): Promise<string> {
    return this.messagesAPI(request.messages, request.temperature || 0.5, request.maxTokens || 2000);
  }
}
