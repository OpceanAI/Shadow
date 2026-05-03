import { Command } from 'commander';
import { GitService } from '../core/git';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import { execFileSync } from 'child_process';

export function contributorsCommand(program: Command): void {
  program
    .command('contributors')
    .description('Contribution analysis')
    .option('--json', 'JSON output')
    .option('--limit <n>', 'Number of contributors to show', '10')
    .action(async (options) => {
      const git = new GitService();
      const isRepo = await git.isGitRepo();

      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      try {
        const root = process.cwd();

        const authorOutput = execFileSync('git', ['shortlog', '-sn', '--all'], {
          cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
        });

        const contributors: Array<{ name: string; commits: number; files: number; insertions: number; deletions: number }> = [];

        const lines = authorOutput.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          const match = line.match(/^\s*(\d+)\s+(.+)$/);
          if (match) {
            const name = match[2].trim();
            const commits = parseInt(match[1], 10);

            let statOutput = '';
            try {
              statOutput = execFileSync('git', ['log', `--author=^${sanitizeGitContributor(name)}$`, '--shortstat', '--oneline'], {
                cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
              });
            } catch {
              // ignore stat errors for individual contributors
            }

            let files = 0;
            let insertions = 0;
            let deletions = 0;
            const statLines = statOutput.split('\n');
            for (const sl of statLines) {
              const fm = sl.match(/(\d+)\s+file/);
              const im = sl.match(/(\d+)\s+insertion/);
              const dm = sl.match(/(\d+)\s+deletion/);
              if (fm) files += parseInt(fm[1], 10);
              if (im) insertions += parseInt(im[1], 10);
              if (dm) deletions += parseInt(dm[1], 10);
            }

            contributors.push({ name, commits, files, insertions, deletions });
          }
        }

        const limit = parseInt(options.limit, 10);
        const top = contributors.slice(0, limit);

        if (options.json) {
          printJSON({ contributors: top, total: contributors.length });
          return;
        }

        console.log(chalk.bold.blue('\n[shadow contributors]\n'));
        console.log(chalk.dim(`${contributors.length} total contributors\n`));

        const maxCommits = top.length > 0 ? Math.max(...top.map((c) => c.commits)) : 1;

        for (const c of top) {
          const barLen = Math.round((c.commits / maxCommits) * 30);
          const bar = chalk.green('█'.repeat(barLen));
          console.log(`  ${chalk.cyan(c.name.slice(0, 20).padEnd(20))} ${bar} ${chalk.bold(String(c.commits))} commits`);
          console.log(`  ${' '.repeat(22)}${chalk.dim(`${c.files} files, +${c.insertions} -${c.deletions}`)}`);
        }
        console.log('');
      } catch {
        console.log(chalk.red('Could not analyze contributors.'));
      }
    });
}

function sanitizeGitContributor(name: string): string {
  return name.replace(/[^a-zA-Z0-9@._\-\s]/g, '');
}
