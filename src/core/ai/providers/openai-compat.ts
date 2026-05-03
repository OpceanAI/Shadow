import { AIProvider, AIExplanation, FixProposal, ProjectInfo, AI_PROVIDERS } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';
import { estimateTokens } from '../token-counter';

export class OpenAICompatProvider extends AIProviderBase {
  private modelName: string;

  constructor(key: AIProvider) {
    super(key);
    this.modelName = AI_PROVIDERS[key].models[0];
  }

  protected async chatCompletion(
    messages: { role: string; content: string }[],
    temperature: number = 0.3,
    maxTokens: number = 2000,
    stream: boolean = false,
  ): Promise<string> {
    const cacheKey = JSON.stringify({ provider: this.providerKey, messages, temperature, maxTokens });

    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.log('cache', 'hit');
      return cached as string;
    }

    try {
      const body: Record<string, unknown> = {
        model: this.modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      const response = await this.httpClient.post(this.apiUrl, body, {
        'Authorization': `Bearer ${this.apiKey}`,
      });

      const data = JSON.parse(response.body);
      const text = data.choices?.[0]?.message?.content || '';

      this.cache.set(cacheKey, text);
      this.log('chat', `tokens: ${estimateTokens(text)}`);

      return text;
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const template = getPromptTemplate('explain', code, language);
    return this.chatCompletion(
      [{ role: 'system', content: template.system }, { role: 'user', content: template.user }],
      template.temperature, template.maxTokens,
    ).then((r) => this.parseExplanation(r));
  }

  async summarizeProject(info: ProjectInfo): Promise<string> {
    const response = await this.chatCompletion([
      { role: 'system', content: 'Summarize this project concisely.' },
      { role: 'user', content: JSON.stringify({ name: info.name, language: info.language, files: info.totalFiles, entryPoints: info.entryPoints }) },
    ], 0.3, 500);
    return response.trim();
  }

  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const template = getPromptTemplate('fix', code, 'unknown', issue);
    const response = await this.chatCompletion(
      [{ role: 'system', content: template.system }, { role: 'user', content: template.user }],
      template.temperature, template.maxTokens,
    );
    return this.parseFixProposal(response, '');
  }

  async generateTests(code: string): Promise<string> {
    const template = getPromptTemplate('test', code, 'unknown');
    return this.chatCompletion(
      [{ role: 'system', content: template.system }, { role: 'user', content: template.user }],
      template.temperature, template.maxTokens,
    );
  }

  async reviewCode(diff: string): Promise<AIReview> {
    const template = getPromptTemplate('review', diff, 'unknown');
    const response = await this.chatCompletion(
      [{ role: 'system', content: template.system }, { role: 'user', content: template.user }],
      template.temperature, template.maxTokens,
    );
    return { summary: response.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }

  async chat(request: ChatRequest): Promise<string> {
    return this.chatCompletion(request.messages, request.temperature || 0.5, request.maxTokens || 2000, request.stream);
  }
}
