import { AIExplanation, FixProposal, ProjectInfo } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';

export class CohereProvider extends AIProviderBase {
  constructor() { super('cohere'); }

  private async chatCompletions(
    messages: { role: string; content: string }[],
    temperature: number = 0.3, maxTokens: number = 2000,
  ): Promise<string> {
    const cacheKey = JSON.stringify({ provider: 'cohere', messages, temperature, maxTokens });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as string;

    try {
      const response = await this.httpClient.post(this.apiUrl, {
        model: this.model,
        messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'CHATBOT' : 'USER', message: m.content })),
        temperature, max_tokens: maxTokens,
      }, { 'Authorization': `Bearer ${this.apiKey}` });

      const data = JSON.parse(response.body);
      const text = data.text || data.message?.content?.[0]?.text || '';
      this.cache.set(cacheKey, text);
      return text;
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const t = getPromptTemplate('explain', code, language);
    return this.chatCompletions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseExplanation(r));
  }
  async summarizeProject(info: ProjectInfo): Promise<string> {
    return this.chatCompletions([{ role: 'user', content: `Summarize:\n${JSON.stringify({ name: info.name, language: info.language, files: info.totalFiles })}` }], 0.3, 500).then((r) => r.trim());
  }
  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const t = getPromptTemplate('fix', code, 'unknown', issue);
    return this.chatCompletions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseFixProposal(r, ''));
  }
  async generateTests(code: string): Promise<string> {
    const t = getPromptTemplate('test', code, 'unknown');
    return this.chatCompletions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
  }
  async reviewCode(diff: string): Promise<AIReview> {
    const t = getPromptTemplate('review', diff, 'unknown');
    const r = await this.chatCompletions([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return { summary: r.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }
  async chat(request: ChatRequest): Promise<string> {
    return this.chatCompletions(request.messages, request.temperature || 0.5, request.maxTokens || 2000);
  }
}
