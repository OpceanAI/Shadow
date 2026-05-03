import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { findFiles, readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function searchCommand(program: Command): void {
  program
    .command('search [pattern]')
    .description('Semantic code search across the project')
    .option('--type <kind>', 'Search type: function, class, import, env, file, all')
    .option('--language <lang>', 'Filter by language')
    .option('--file <glob>', 'Filter by file pattern')
    .option('--json', 'JSON output')
    .action(async (pattern, options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const searchType = options.type || 'all';
      const results: Array<{ file: string; line: number; match: string; kind: string }> = [];

      for (const file of project.files) {
        if (options.language && file.language !== options.language) continue;
        if (options.file && !file.path.includes(options.file.replace(/\*/g, ''))) continue;

        if (searchType === 'all' || searchType === 'function') {
          for (const fn of file.functions) {
            if (!pattern || fn.toLowerCase().includes(pattern.toLowerCase())) {
              results.push({ file: file.path, line: 0, match: fn, kind: 'function' });
            }
          }
        }

        if (searchType === 'all' || searchType === 'class') {
          for (const cls of file.classes) {
            if (!pattern || cls.toLowerCase().includes(pattern.toLowerCase())) {
              results.push({ file: file.path, line: 0, match: cls, kind: 'class' });
            }
          }
        }

        if (searchType === 'all' || searchType === 'import') {
          for (const imp of file.imports) {
            if (!pattern || imp.name.toLowerCase().includes(pattern.toLowerCase())) {
              results.push({ file: file.path, line: 0, match: imp.name, kind: `import (${imp.type})` });
            }
          }
        }

        if (searchType === 'all' || searchType === 'env') {
          for (const env of file.envVars) {
            if (!pattern || env.toLowerCase().includes(pattern.toLowerCase())) {
              results.push({ file: file.path, line: 0, match: env, kind: 'env' });
            }
          }
        }

        if (!pattern || searchType === 'file') {
          if (!pattern || file.path.toLowerCase().includes(pattern.toLowerCase())) {
            results.push({ file: file.path, line: 0, match: file.path, kind: 'file' });
          }
        }
      }

      if (options.json) {
        printJSON({ pattern, results, count: results.length });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow search]\n'));
      if (pattern) {
        console.log(chalk.dim(`Pattern: "${pattern}" (${searchType})`));
      } else {
        console.log(chalk.dim(`Showing all ${searchType}s`));
      }
      console.log(chalk.dim(`${results.length} results\n`));

      const kindColors: Record<string, (s: string) => string> = {
        'function': chalk.cyan,
        'class': chalk.magenta,
        'env': chalk.yellow,
        'file': chalk.green,
      };

      for (const r of results) {
        const colorFn = (label: string) => {
          for (const [k, fn] of Object.entries(kindColors)) {
            if (r.kind.startsWith(k)) return fn(label);
          }
          return chalk.gray(label);
        };

        console.log(`  ${colorFn(`[${r.kind}]`)} ${chalk.white(r.match)} ${chalk.dim(`→ ${r.file}`)}`);
      }
      console.log('');
    });
}
