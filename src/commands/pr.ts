import { Command } from 'commander';
import { GitService } from '../core/git';
import { AIProviderService } from '../core/ai-provider';
import { loadConfig } from '../core/config';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import { execFileSync } from 'child_process';

export function prCommand(program: Command): void {
  program
    .command('pr [number]')
    .description('Analyze a GitHub pull request')
    .option('--url <url>', 'PR URL instead of number')
    .option('--json', 'JSON output')
    .action(async (number, options) => {
      const config = loadConfig();
      const git = new GitService();

      console.log(chalk.bold.blue('\n[shadow pr]\n'));

      let prData: Record<string, unknown> = {};

      try {
        if (options.url) {
          const urlMatch = options.url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
          if (urlMatch) {
            number = urlMatch[3];
          }
        }

        if (!number || !/^\d+$/.test(String(number))) {
          console.log(chalk.yellow('Please provide a PR number.'));
          console.log('Usage: shadow pr <number>');
          console.log('');
          return;
        }

        const useGH = !!(process.env.GITHUB_TOKEN || process.env.GH_TOKEN);

        if (useGH) {
          try {
            const result = execFileSync('gh', ['pr', 'view', String(number), '--json', 'title,body,state,additions,deletions,changedFiles,reviews,author,labels'], {
              encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
            });
            prData = JSON.parse(result);
          } catch {
            console.log(chalk.yellow('Could not fetch PR details.'));
            console.log(chalk.dim('Install gh CLI (github.com/cli/cli) or set GITHUB_TOKEN.'));
            console.log('');
            return;
          }
        }

        if (options.json) {
          printJSON(prData);
          return;
        }

        const title = prData.title as string || 'Unknown';
        const state = prData.state as string || 'unknown';
        const author = prData.author && (prData.author as Record<string, string>).login || 'unknown';
        const additions = prData.additions as number || 0;
        const deletions = prData.deletions as number || 0;
        const files = prData.changedFiles as number || 0;
        const labels = (prData.labels as Array<{ name: string }>) || [];
        const reviews = (prData.reviews as Array<{ state: string; author: { login: string } }>) || [];

        console.log(chalk.bold(`${title}`));
        console.log(chalk.dim(`#${number} by ${author} • ${state}`));
        console.log(`  +${chalk.green(String(additions))} -${chalk.red(String(deletions))} in ${files} files`);

        if (labels.length > 0) {
          console.log(`  Labels: ${labels.map((l: { name: string }) => l.name).join(', ')}`);
        }

        if (reviews.length > 0) {
          const approved = reviews.filter((r: { state: string }) => r.state === 'APPROVED').length;
          const changes = reviews.filter((r: { state: string }) => r.state === 'CHANGES_REQUESTED').length;
          console.log(`  Reviews: ${chalk.green(String(approved))} approved, ${chalk.red(String(changes))} changes requested`);
        }

        const riskScore = calculateRisk(additions, deletions, files);
        const riskColor = riskScore < 30 ? chalk.green : riskScore < 60 ? chalk.yellow : chalk.red;
        console.log(`  Risk: ${riskColor(`${riskScore}/100`)}`);
        console.log('');
      } catch {
        console.log(chalk.red('Could not analyze PR.'));
      }
    });
}

function calculateRisk(additions: number, deletions: number, files: number): number {
  let score = 0;
  score += Math.min(additions / 10, 40);
  score += Math.min(deletions / 10, 30);
  score += Math.min(files * 5, 30);
  return Math.min(Math.round(score), 100);
}
