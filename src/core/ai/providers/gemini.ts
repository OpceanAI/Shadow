import { AIExplanation, FixProposal, ProjectInfo, AI_PROVIDERS } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';

export class GeminiProvider extends AIProviderBase {
  constructor() { super('gemini'); }

  private async generateContent(
    systemPrompt: string, userPrompt: string,
    temperature: number = 0.3, maxTokens: number = 2000,
  ): Promise<string> {
    const cacheKey = JSON.stringify({ provider: 'gemini', systemPrompt, userPrompt, temperature, maxTokens });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached as string;

    try {
      const contents = [
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
        { role: 'user', parts: [{ text: userPrompt }] },
      ];
      const modelName = AI_PROVIDERS['gemini'].models[0];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;
      const response = await this.httpClient.post(url, { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } }, {});
      const data = JSON.parse(response.body);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      this.cache.set(cacheKey, text);
      return text;
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const t = getPromptTemplate('explain', code, language);
    return this.generateContent(t.system, t.user, t.temperature, t.maxTokens).then((r) => this.parseExplanation(r));
  }
  async summarizeProject(info: ProjectInfo): Promise<string> {
    return this.generateContent('', `Summarize:\n${JSON.stringify({ name: info.name, language: info.language, files: info.totalFiles })}`, 0.3, 500).then((r) => r.trim());
  }
  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const t = getPromptTemplate('fix', code, 'unknown', issue);
    return this.generateContent(t.system, t.user, t.temperature, t.maxTokens).then((r) => this.parseFixProposal(r, ''));
  }
  async generateTests(code: string): Promise<string> {
    const t = getPromptTemplate('test', code, 'unknown');
    return this.generateContent(t.system, t.user, t.temperature, t.maxTokens);
  }
  async reviewCode(diff: string): Promise<AIReview> {
    const t = getPromptTemplate('review', diff, 'unknown');
    const r = await this.generateContent(t.system, t.user, t.temperature, t.maxTokens);
    return { summary: r.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }
  async chat(request: ChatRequest): Promise<string> {
    const system = request.messages.find((m) => m.role === 'system')?.content || '';
    const user = request.messages.filter((m) => m.role !== 'system').map((m) => `${m.role}: ${m.content}`).join('\n');
    return this.generateContent(system, user, request.temperature || 0.5, request.maxTokens || 2000);
  }
}
