import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import { execFileSync } from 'child_process';

export function issueCommand(program: Command): void {
  program
    .command('issue [number]')
    .description('Analyze a GitHub issue and suggest files')
    .option('--url <url>', 'Issue URL instead of number')
    .option('--json', 'JSON output')
    .action(async (number, options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();

      console.log(chalk.bold.blue('\n[shadow issue]\n'));

      let issueTitle = '';
      let issueBody = '';

      if (number && /^\d+$/.test(String(number))) {
        try {
          const result = execFileSync('gh', ['issue', 'view', String(number), '--json', 'title,body'], {
            encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
          });
          const data = JSON.parse(result);
          issueTitle = data.title || '';
          issueBody = data.body || '';
        } catch {
          console.log(chalk.yellow('Could not fetch issue. Using project analysis instead.'));
        }
      }

      const keywords = extractKeywords(issueTitle + ' ' + issueBody);

      const relevantFiles: Array<{ file: string; score: number; reasons: string[] }> = [];

      for (const file of project.files) {
        let score = 0;
        const reasons: string[] = [];

        for (const kw of keywords) {
          const lowerPath = file.path.toLowerCase();
          if (lowerPath.includes(kw)) {
            score += 3;
            reasons.push(`Path matches "${kw}"`);
          }

          for (const fn of file.functions) {
            if (fn.toLowerCase().includes(kw)) {
              score += 2;
              reasons.push(`Function "${fn}" matches "${kw}"`);
            }
          }

          for (const cls of file.classes) {
            if (cls.toLowerCase().includes(kw)) {
              score += 2;
              reasons.push(`Class "${cls}" matches "${kw}"`);
            }
          }

          for (const imp of file.imports) {
            if (imp.name.toLowerCase().includes(kw)) {
              score += 1;
              reasons.push(`Import "${imp.name}" matches "${kw}"`);
            }
          }
        }

        if (score > 0) {
          relevantFiles.push({ file: file.path, score, reasons: [...new Set(reasons)] });
        }
      }

      relevantFiles.sort((a, b) => b.score - a.score);

      if (options.json) {
        printJSON({ issue: { title: issueTitle }, keywords, relevantFiles });
        return;
      }

      if (issueTitle) {
        console.log(chalk.bold(`Issue #${number}: ${issueTitle}`));
        if (keywords.length > 0) {
          console.log(chalk.dim(`Keywords: ${keywords.join(', ')}`));
        }
        console.log('');
      }

      if (relevantFiles.length === 0) {
        console.log(chalk.yellow('No directly relevant files found.'));
        console.log(chalk.dim('Try examining these entry points:'));
        for (const ep of project.entryPoints.slice(0, 5)) {
          console.log(`  ${chalk.cyan('↳')} ${ep}`);
        }
      } else {
        console.log(chalk.bold(`Top relevant files (${relevantFiles.length} total):`));
        for (const rf of relevantFiles.slice(0, 10)) {
          console.log(`  ${chalk.cyan('↳')} ${rf.file} ${chalk.dim(`(score: ${rf.score})`)}`);
          for (const reason of rf.reasons.slice(0, 2)) {
            console.log(`    ${chalk.dim(reason)}`);
          }
        }
      }
      console.log('');
    });
}

function extractKeywords(text: string): string[] {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s._/-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .filter((w) => !['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'when', 'what', 'how', 'our', 'are'].includes(w));

  return [...new Set(words)];
}
