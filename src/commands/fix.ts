import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { AIProviderService } from '../core/ai-provider';
import chalk from 'chalk';

export function fixCommand(program: Command): void {
  program
    .command('fix')
    .description('Apply or preview suggested changes')
    .option('--issue <description>', 'Issue to fix')
    .option('--dry-run', 'Preview without applying')
    .action(async (options) => {
      const config = loadConfig();
      const ai = new AIProviderService(config);

      console.log(chalk.bold.blue('\n[shadow fix]\n'));

      const issue = options.issue || 'general issues';
      const proposal = await ai.suggestFix(issue);

      console.log(chalk.bold(`Proposal: ${proposal.title}`));
      console.log(chalk.dim(proposal.description));
      console.log(chalk.yellow(`Risk: ${proposal.risk}`));

      if (options.dryRun) {
        console.log(chalk.dim('\n--dry-run enabled. No changes applied.'));
      } else {
        console.log(chalk.green('\nReview the proposed changes before applying.'));
      }

      console.log('');
    });
}
