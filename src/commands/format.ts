import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, writeFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function formatCommand(program: Command): void {
  program
    .command('format')
    .description('Code formatter for multi-language projects')
    .option('--check', 'Check only, do not write changes')
    .option('--language <lang>', 'Target specific language')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      let changed = 0;
      let checked = 0;

      const formatFile = (filePath: string, content: string): string => {
        let result = content;

        result = result.replace(/\t/g, '  ');

        result = result.replace(/[ \t]+$/gm, '');

        if (!result.endsWith('\n')) {
          result += '\n';
        }

        result = result.replace(/\n{3,}/g, '\n\n');

        return result;
      };

      for (const file of project.files) {
        if (options.language && file.language !== options.language) continue;
        checked++;

        try {
          const content = readFile(file.path);
          const formatted = formatFile(file.path, content);

          if (formatted !== content) {
            changed++;
            if (!options.check) {
              writeFile(file.path, formatted);
            }
            if (!options.json) {
              console.log(`  ${chalk.yellow('F')} ${file.path}`);
            }
          }
        } catch {
          // skip unreadable files
        }
      }

      if (options.json) {
        printJSON({ checked, changed, mode: options.check ? 'check' : 'write' });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow format]\n'));

      if (options.check) {
        if (changed === 0) {
          console.log(chalk.green(`All ${checked} files are properly formatted.`));
        } else {
          console.log(chalk.yellow(`${changed} of ${checked} files need formatting.`));
          console.log(chalk.dim('Run without --check to apply formatting.'));
        }
      } else {
        if (changed === 0) {
          console.log(chalk.green(`All ${checked} files were already formatted.`));
        } else {
          console.log(chalk.green(`${changed} file(s) formatted.`));
        }
      }
      console.log('');
    });
}
