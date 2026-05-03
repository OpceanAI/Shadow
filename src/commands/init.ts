import { Command } from 'commander';
import chalk from 'chalk';
import { printSuccess, printError } from '../output/human';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { fileExists } from '../utils/fs';
import * as path from 'path';
import * as fs from 'fs';

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Shadow in a repository')
    .option('--force', 'Overwrite existing Shadow metadata')
    .option('--lang <language>', 'Force a language guess')
    .option('--json', 'Machine-readable output')
    .action(async (options) => {
      const config = loadConfig();
      const shadowDir = path.join(process.cwd(), '.shadow');

      if (fileExists(shadowDir) && !options.force) {
        printError('.shadow/ already exists. Use --force to overwrite.');
        return;
      }

      try {
        fs.mkdirSync(shadowDir, { recursive: true });
        fs.mkdirSync(path.join(shadowDir, 'cache'), { recursive: true });
        fs.mkdirSync(path.join(shadowDir, 'graphs'), { recursive: true });
        fs.mkdirSync(path.join(shadowDir, 'traces'), { recursive: true });
        fs.mkdirSync(path.join(shadowDir, 'reports'), { recursive: true });
      } catch (err) {
        console.warn(chalk.yellow(`Warning: could not create directories in ${shadowDir}: ${(err as Error).message}`));
        return;
      }

      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();

      try {
        fs.writeFileSync(
          path.join(shadowDir, 'config.json'),
          JSON.stringify({ language: options.lang || project.language }, null, 2),
          'utf-8',
        );
      } catch (err) {
        console.warn(chalk.yellow(`Warning: could not write config.json: ${(err as Error).message}`));
      }

      if (options.json) {
        console.log(JSON.stringify({ status: 'ok', language: project.language }));
      } else {
        printSuccess(`Shadow initialized for ${project.language} project`);
      }
    });
}
