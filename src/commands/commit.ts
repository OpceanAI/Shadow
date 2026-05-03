import { Command } from 'commander';
import { GitService } from '../core/git';
import chalk from 'chalk';

export function commitCommand(program: Command): void {
  program
    .command('commit')
    .description('Create a semantic, meaningful commit message')
    .action(async () => {
      const git = new GitService();

      console.log(chalk.bold.blue('\n[shadow commit]\n'));

      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      const message = await git.generateCommitMessage();
      console.log(chalk.bold('Suggested commit message:'));
      console.log(`  ${chalk.green(message)}`);
      console.log('');

      const status = await git.getStatus();
      console.log(chalk.dim(status));
      console.log('');
    });
}
