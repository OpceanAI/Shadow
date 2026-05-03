import { AIProviderService } from '../ai-provider';
import { AI_PROVIDERS, ShadowConfig } from '../../types';
import { readFile as fsReadFile, fileExists as fsFileExists } from '../../utils/fs';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';
import chalk from 'chalk';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatSession {
  messages: ChatMessage[];
  config: ShadowConfig;
  providerService: AIProviderService;
  contextFiles: Map<string, string>;
}

export function createChatSession(config: ShadowConfig): ChatSession {
  return {
    messages: [
      {
        role: 'system',
        content: `You are Shadow, a code analysis assistant. You help with understanding, improving, and generating code for a project at ${process.cwd()}.

When users reference files with @filename, read and analyze them.
Be concise, specific, and practical. Show code snippets when relevant.`,
      },
    ],
    config,
    providerService: new AIProviderService(config),
    contextFiles: new Map(),
  };
}

export function addUserMessage(
  session: ChatSession,
  content: string,
): ChatSession {
  const resolved = resolveFileReferences(content);
  session.messages.push({ role: 'user', content: resolved });
  return session;
}

export function addAssistantMessage(
  session: ChatSession,
  content: string,
): ChatSession {
  session.messages.push({ role: 'assistant', content });
  return session;
}

function resolveFileReferences(text: string): string {
  const fileRefRegex = /@([\w./-]+)/g;
  return text.replace(fileRefRegex, (match, filePath) => {
    try {
      const resolved = path.resolve(process.cwd(), filePath);
      if (fsFileExists && fsFileExists(resolved)) {
        const content = fsReadFile && fsReadFile(resolved);
        const ext = path.extname(resolved).slice(1);
        return `\n\n[File: ${filePath}]\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
      }
    } catch {
      // ignore
    }
    return match;
  });
}

export async function processChatMessage(
  session: ChatSession,
  userInput: string,
): Promise<string> {
  addUserMessage(session, userInput);

  const info = AI_PROVIDERS[session.config.aiProvider || 'local'];

  try {
    const response = await session.providerService.chat({
      messages: session.messages,
      model: info.models[0],
    });

    addAssistantMessage(session, response);
    return response;
  } catch (error: unknown) {
    const err = error as Error;
    const fallback = `I encountered an error connecting to ${info.name}: ${err.message}.

Here's what I can tell you without AI:
- Use \`shadow info\` to analyze your project
- Use \`shadow explain <file>\` to explain a file
- Use \`shadow test\` to run tests
- Use \`shadow graph\` to see dependencies

Set an API key (e.g. \`export OPENAI_API_KEY=...\`) and try again.`;

    addAssistantMessage(session, fallback);
    return fallback;
  }
}

export function getConversationSummary(session: ChatSession): string {
  const userMsgs = session.messages.filter((m) => m.role === 'user');
  const assistantMsgs = session.messages.filter((m) => m.role === 'assistant');
  return `${userMsgs.length} exchanges, ${session.contextFiles.size} files loaded`;
}

export function exportConversation(session: ChatSession): string {
  const lines: string[] = ['# Shadow Chat Export\n'];
  for (const msg of session.messages) {
    const prefix = msg.role === 'user' ? '### User' : msg.role === 'assistant' ? '### Assistant' : '### System';
    lines.push(`${prefix}\n${msg.content}\n`);
  }
  return lines.join('\n');
}

export async function startInteractiveChat(config: ShadowConfig): Promise<void> {
  console.log(chalk.bold.blue('\n[shadow chat]'));
  console.log(chalk.dim('Type your questions about the codebase. Use @file to reference files.'));
  console.log(chalk.dim('Press Ctrl+C or type /exit to quit.\n'));

  const provider = AI_PROVIDERS[config.aiProvider || 'local'];
  console.log(chalk.dim(`Provider: ${provider.name} (${provider.models[0]})`));
  console.log();

  const session = createChatSession(config);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('chat> '),
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    const input = line.trim();

    if (input === '/exit' || input === '/quit') {
      console.log(chalk.dim('\nExiting chat.'));
      rl.close();
      return;
    }

    if (input === '/clear') {
      session.messages = session.messages.slice(0, 1);
      console.log(chalk.dim('Chat history cleared.'));
      rl.prompt();
      return;
    }

    if (input === '/context') {
      console.log(chalk.dim(getConversationSummary(session)));
      rl.prompt();
      return;
    }

    if (input === '/export') {
      const exportPath = path.join(process.cwd(), 'shadow-chat-export.md');
      try {
        fs.writeFileSync(exportPath, exportConversation(session), 'utf-8');
        console.log(chalk.green(`Exported to ${exportPath}`));
      } catch (err) {
        console.warn(chalk.yellow(`Warning: could not write to ${exportPath}: ${(err as Error).message}`));
      }
      rl.prompt();
      return;
    }

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      console.log();
      const response = await processChatMessage(session, input);
      console.log(chalk.white(response));
      console.log();
    } catch (error: unknown) {
      const err = error as Error;
      console.log(chalk.red(`Error: ${err.message}`));
    }

    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.dim('\nChat session ended.\n'));
  });
}
