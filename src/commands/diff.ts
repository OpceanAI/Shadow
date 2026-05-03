import { Command } from 'commander';
import { GitService } from '../core/git';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function diffCommand(program: Command): void {
  program
    .command('diff')
    .description('Compare versions semantically')
    .option('--from <ref>', 'Base reference')
    .option('--to <ref>', 'Target reference')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const git = new GitService();

      console.log(chalk.bold.blue('\n[shadow diff]\n'));

      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      const diff = await git.getDiff(options.from, options.to);

      if (options.json) {
        printJSON(diff);
        return;
      }

      console.log(chalk.bold(`Comparing ${diff.from} → ${diff.to}`));
      console.log('');
      console.log(`${chalk.green('+')} ${diff.additions} additions`);
      console.log(`${chalk.red('-')} ${diff.deletions} deletions`);
      console.log(`${chalk.bold('Files changed:')} ${diff.filesChanged.length}`);

      if (diff.filesChanged.length > 0) {
        console.log('');
        diff.filesChanged.slice(0, 20).forEach((f) => console.log(`  ${chalk.cyan('↳')} ${f}`));
        if (diff.filesChanged.length > 20) {
          console.log(chalk.dim(`  ... and ${diff.filesChanged.length - 20} more`));
        }
      }

      if (diff.areasToRetest.length > 0) {
        console.log(`\n${chalk.bold('Areas to retest:')}`);
        diff.areasToRetest.slice(0, 10).forEach((a) => console.log(`  ${chalk.yellow('○')} ${a}`));
      }

      console.log('');
    });
}
