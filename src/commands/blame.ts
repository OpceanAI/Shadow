import { Command } from 'commander';
import { GitService } from '../core/git';
import { readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as path from 'path';
import { execFileSync } from 'child_process';

export function blameCommand(program: Command): void {
  program
    .command('blame')
    .description('Git blame with context')
    .option('--file <path>', 'File to blame')
    .option('--line <n>', 'Specific line number')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const git = new GitService();
      const isRepo = await git.isGitRepo();

      if (!isRepo) {
        console.log(chalk.red('Not a git repository.'));
        return;
      }

      const filePath = options.file;
      const targetLine = options.line ? parseInt(options.line, 10) : undefined;
      const root = process.cwd();

      if (!filePath) {
        console.log(chalk.bold.blue('\n[shadow blame]\n'));
        console.log(chalk.yellow('Specify a file with --file <path>'));
        console.log('');
        return;
      }

      const fullPath = path.resolve(root, filePath);

      try {
        const content = readFile(fullPath);
        const lines = content.split('\n');

        let blameLines: string[] = [];
        try {
          const blame = execFileSync('git', ['blame', '--line-porcelain', fullPath], {
            cwd: root, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
          });
          blameLines = blame.split('\n');
        } catch {
          console.log(chalk.red(`Could not get blame for ${filePath}`));
          return;
        }

        const entries: Array<{ line: number; hash: string; author: string; date: string; summary: string; content: string }> = [];
        let current: Partial<typeof entries[0]> = {};

        for (const bl of blameLines) {
          if (/^[0-9a-f]{40}/.test(bl)) {
            const parts = bl.split(' ');
            current = { hash: parts[0], line: parseInt(parts[1], 10) };
          } else if (bl.startsWith('author ')) {
            current.author = bl.slice(7);
          } else if (bl.startsWith('author-time ')) {
            current.date = new Date(parseInt(bl.slice(12), 10) * 1000).toISOString().split('T')[0];
          } else if (bl.startsWith('summary ')) {
            current.summary = bl.slice(8);
          } else if (bl.startsWith('\t')) {
            current.content = bl.slice(1);
            if (current.line && current.author) {
              entries.push(current as typeof entries[0]);
            }
          }
        }

        const filtered = targetLine
          ? entries.filter((e) => e.line === targetLine)
          : entries;

        if (options.json) {
          printJSON({ file: filePath, entries: filtered });
          return;
        }

        console.log(chalk.bold.blue(`\n[shadow blame] ${filePath}\n`));
        for (const entry of filtered) {
          const lineNum = String(entry.line).padStart(4, ' ');
          console.log(
            `${chalk.dim(lineNum)} ${chalk.yellow(entry.hash.slice(0, 7))} ` +
            `${chalk.cyan(entry.author.slice(0, 12).padEnd(12))} ` +
            `${chalk.dim(entry.date)} ${entry.content}`,
          );
        }
        console.log('');
      } catch {
        console.log(chalk.red(`File not found: ${filePath}`));
      }
    });
}
