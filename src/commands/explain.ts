import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { AIProviderService } from '../core/ai-provider';
import { printFileInfo } from '../output/human';
import chalk from 'chalk';

export function explainCommand(program: Command): void {
  program
    .command('explain [target]')
    .description('Explain a specific file, line, block, or concept')
    .action(async (target) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const ai = new AIProviderService(config);

      console.log(chalk.bold.blue('\n[shadow explain]\n'));

      if (!target) {
        console.log(chalk.yellow('Usage: shadow explain <file>'));
        console.log('       shadow explain <file>:<line>');
        console.log('       shadow explain <concept>');
        return;
      }

      const lineMatch = target.match(/^(.+):(\d+)$/);

      if (lineMatch) {
        const [, filePath, line] = lineMatch;
        const info = analyzer.analyzeFile(filePath);
        const explanation = await ai.explainFile(filePath, info);
        console.log(chalk.bold(explanation.summary));
        console.log(chalk.dim(`Line ${line}: ${filePath}`));
      } else if (target.includes('?') || target.includes('why') || target.includes('how')) {
        console.log(chalk.bold(`Question: ${target}`));
        console.log(chalk.dim('Analysis not yet available. Use --ai for AI-powered explanation.'));
      } else {
        const info = analyzer.analyzeFile(target);
        printFileInfo(info);
      }

      console.log('');
    });
}
