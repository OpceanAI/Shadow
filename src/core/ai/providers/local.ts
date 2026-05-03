import { AIExplanation, FixProposal, ProjectInfo } from '../../../types';
import { AIProviderBase, AIReview, ChatRequest } from '../base';
import { getPromptTemplate } from '../prompt-templates';

export class LocalProvider extends AIProviderBase {
  constructor() { super('local'); }

  private async localChat(
    messages: { role: string; content: string }[],
    temperature: number = 0.5, maxTokens: number = 2000,
  ): Promise<string> {
    try {
      const response = await this.httpClient.post(this.apiUrl, {
        model: this.model, messages, stream: false,
        options: { temperature, num_predict: maxTokens },
      }, {});
      const data = JSON.parse(response.body);
      return data.message?.content || data.response || '';
    } catch (error: unknown) {
      this.log('error', (error as Error).message);
      throw error;
    }
  }

  async explainCode(code: string, language: string): Promise<AIExplanation> {
    const t = getPromptTemplate('explain', code, language);
    return this.localChat([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseExplanation(r));
  }
  async summarizeProject(info: ProjectInfo): Promise<string> {
    return `${info.name} is a ${info.language} project with ${info.totalFiles} files. ${info.summary}`;
  }
  async suggestFix(code: string, issue: string): Promise<FixProposal> {
    const t = getPromptTemplate('fix', code, 'unknown', issue);
    return this.localChat([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens).then((r) => this.parseFixProposal(r, ''));
  }
  async generateTests(code: string): Promise<string> {
    const t = getPromptTemplate('test', code, 'unknown');
    return this.localChat([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
  }
  async reviewCode(diff: string): Promise<AIReview> {
    const t = getPromptTemplate('review', diff, 'unknown');
    const r = await this.localChat([{ role: 'system', content: t.system }, { role: 'user', content: t.user }], t.temperature, t.maxTokens);
    return { summary: r.slice(0, 500), issues: [], suggestions: [], score: 7 };
  }
  async chat(request: ChatRequest): Promise<string> {
    return this.localChat(request.messages, request.temperature || 0.5, request.maxTokens || 2000);
  }
}
