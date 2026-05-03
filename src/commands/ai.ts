import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { AIProviderService } from '../core/ai-provider';
import { Analyzer } from '../core/analyzer';
import { printJSON } from '../output/json';
import { AI_PROVIDERS, AIProvider } from '../types';
import chalk from 'chalk';

export function aiCommand(program: Command): void {
  program
    .command('ai <action> [target]')
    .description('Use AI to explain, summarize, or propose changes')
    .option('--provider <provider>', 'AI provider (openai|claude|gemini|xai|deepseek|mistral|groq|meta|cohere|together|perplexity|fireworks|cerebras|replicate|local)')
    .option('--diff', 'Show diff of suggested changes')
    .option('--patch', 'Output as patch')
    .option('--apply', 'Apply suggested changes')
    .option('--dry-run', 'Preview without applying')
    .action(async (action, target, options) => {
      const config = loadConfig();
      if (options.provider) {
        const validProviders = Object.keys(AI_PROVIDERS) as AIProvider[];
        if (validProviders.includes(options.provider as AIProvider)) {
          config.aiProvider = options.provider as AIProvider;
        } else {
          console.error(chalk.red(`Invalid provider: ${options.provider}`));
          console.error(`Valid providers: ${validProviders.join(', ')}`);
          process.exit(1);
        }
      }

      const ai = new AIProviderService(config);
      const analyzer = new Analyzer(config);

      if (action === 'providers') {
        listProviders();
        return;
      }

      const info = ai.providerInfo;
      console.log(chalk.bold.blue('\n[shadow ai]'));
      console.log(chalk.dim(`Provider: ${info.name} | ${info.models[0]}${!ai.hasApiKey() ? chalk.red(' [no key]') : ''}`));
      console.log();

      switch (action) {
        case 'explain': {
          const filePath = target || 'app.py';
          const info = analyzer.analyzeFile(filePath);
          const explanation = await ai.explainFile(filePath, info);
          console.log(chalk.bold(explanation.summary));
          explanation.details.forEach((d) => console.log(`  ${chalk.dim(d)}`));
          break;
        }
        case 'summarize': {
          const project = analyzer.analyzeProject();
          const summary = await ai.summarizeProject(project);
          console.log(summary);
          break;
        }
        case 'suggest': {
          const fileInfo = analyzer.analyzeFile(target || '.');
          const bugs = await ai.identifyBugs(fileInfo);
          if (bugs.length === 0) {
            console.log(chalk.green('No suggestions.'));
          } else {
            bugs.forEach((b) => console.log(`  ${chalk.yellow('○')} ${b}`));
          }
          break;
        }
        case 'fix': {
          console.log(chalk.yellow(`Fixing: ${target || 'current project'}`));
          const proposal = await ai.suggestFix(target || 'general issue');
          console.log(`  ${chalk.bold(proposal.title)}`);
          console.log(`  ${chalk.dim(proposal.description)}`);
          break;
        }
        default:
          console.log(chalk.yellow(`Unknown action: ${action}`));
          console.log('Available: explain, summarize, suggest, fix, providers');
      }

      console.log('');
    });
}

function listProviders(): void {
  console.log(chalk.bold.blue('\n[shadow ai providers]\n'));

  const maxNameLen = Math.max(...Object.values(AI_PROVIDERS).map((p) => p.name.length));

  for (const [key, provider] of Object.entries(AI_PROVIDERS)) {
    const pad = ' '.repeat(maxNameLen - provider.name.length + 2);
    const keySet = provider.envKey
      ? process.env[provider.envKey]
        ? chalk.green(`✓ ${provider.envKey}`)
        : chalk.red(`✗ ${provider.envKey}`)
      : chalk.dim('(no key needed)');
    console.log(`  ${chalk.cyan(key.padEnd(12))}${chalk.bold(provider.name)}${pad}${keySet}`);
    console.log(`  ${' '.repeat(12)}${chalk.dim('Models: ' + provider.models.join(', '))}`);
  }

  console.log();
  console.log(chalk.dim('Set the env var to use a provider, e.g. export OPENAI_API_KEY=sk-...'));
  console.log(chalk.dim('Usage: shadow ai explain app.py --provider gemini'));
  console.log();
}
