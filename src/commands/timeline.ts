import { Command } from 'commander';
import { GitService } from '../core/git';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import { execFileSync } from 'child_process';

function sanitizeGitArg(value: string): string {
  return value.replace(/[^a-zA-Z0-9@._\-\/\\ ]/g, '');
}

export function timelineCommand(program: Command): void {
  program
    .command('timeline')
    .description('Git timeline with semantic analysis')
    .option('--limit <n>', 'Number of commits to show', '30')
    .option('--json', 'JSON output')
    .option('--author <name>', 'Filter by author')
    .option('--since <date>', 'Commits since date (YYYY-MM-DD)')
    .action(async (options) => {
      const git = new GitService();
      const isRepo = await git.isGitRepo();

      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      try {
        const root = process.cwd();
        const limit = parseInt(options.limit, 10);
        const args = ['log', '--oneline', '--decorate', `-${limit}`];

        if (options.author) {
          args.push(`--author=${sanitizeGitArg(options.author)}`);
        }
        if (options.since) {
          args.push(`--since=${sanitizeGitArg(options.since)}`);
        }

        const output = execFileSync('git', args, { cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
        const lines = output.trim().split('\n').filter(Boolean);

        const commits = lines.map((line: string) => {
          const match = line.match(/^([a-f0-9]+)\s+(.+?)(?:\s*\((.*?)\))?$/);
          if (match) {
            return {
              hash: match[1],
              message: match[2].trim(),
              refs: match[3] ? match[3].split(',').map((r: string) => r.trim()) : [],
            };
          }
          return { hash: line.slice(0, 7), message: line.slice(8), refs: [] };
        });

        const stats = commits.map((c: { hash: string }) => {
          try {
            const statOutput = execFileSync('git', ['show', '--stat', '--format=', c.hash], {
              cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
            });
            const lastLine = statOutput.trim().split('\n').pop() || '';
            const numMatch = lastLine.match(/(\d+)\s+file/);
            return { files: numMatch ? parseInt(numMatch[1], 10) : 0 };
          } catch {
            return { files: 0 };
          }
        });

        for (let i = 0; i < commits.length; i++) {
          (commits[i] as Record<string, unknown>).filesChanged = stats[i]?.files || 0;
        }

        if (options.json) {
          printJSON({ commits, total: commits.length });
          return;
        }

        console.log(chalk.bold.blue('\n[shadow timeline]\n'));

        const totalFiles = commits.reduce((s: number, c: Record<string, unknown>) => s + (c.filesChanged as number), 0);
        console.log(chalk.dim(`${commits.length} commits, ${totalFiles} files changed\n`));

        for (const commit of commits) {
          const refs = commit.refs as string[];
          let prefix = `  ${chalk.yellow(commit.hash.slice(0, 7))}`;
          if (refs.length > 0) {
            const refLabels = refs.map((r: string) => chalk.cyan(`[${r}]`)).join(' ');
            prefix += ` ${refLabels}`;
          }
          console.log(`${prefix} ${commit.message}`);
          const fc = (commit as Record<string, unknown>).filesChanged as number || 0;
          console.log(`      ${chalk.dim(`${fc} file(s)`)}`);
        }
        console.log('');
      } catch {
        console.log(chalk.red('Could not read git log.'));
      }
    });
}
