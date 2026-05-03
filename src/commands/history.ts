import { Command } from 'commander';
import { GitService } from '../core/git';
import chalk from 'chalk';

export function historyCommand(program: Command): void {
  program
    .command('history')
    .description('View semantic commit history')
    .option('--limit <n>', 'Number of commits to show', '20')
    .action(async (options) => {
      const git = new GitService();

      console.log(chalk.bold.blue('\n[shadow history]\n'));

      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      const history = await git.getHistory(parseInt(options.limit));
      console.log(history);
      console.log('');
    });
}
