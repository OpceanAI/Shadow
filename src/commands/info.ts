import { Command } from 'commander';
import { printProjectInfo, printFileInfo } from '../output/human';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { fileExists } from '../utils/fs';
import * as fs from 'fs';
import * as path from 'path';
import { printJSON } from '../output/json';

export function infoCommand(program: Command): void {
  program
    .command('info [target]')
    .description('Explain what a file or project does')
    .option('--short', 'One-line summary')
    .option('--json', 'Structured output')
    .option('--deps', 'Dependency-focused view')
    .option('--env', 'Environment-focused view')
    .option('--graph', 'Connection graph')
    .option('--all', 'Full detail')
    .action(async (target, options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);

      const targetPath = target ? path.resolve(target) : process.cwd();

      let isFile = false;
      try {
        isFile = fileExists(targetPath) && !fs.statSync(targetPath).isDirectory();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error accessing "${targetPath}": ${message}`);
        process.exit(1);
      }

      if (isFile) {
        const info = analyzer.analyzeFile(targetPath);

        if (options.json) {
          printJSON(info);
          return;
        }

        printFileInfo(info);

        if (options.env) {
          console.log('Environment variables:');
          info.envVars.forEach((v) => console.log(`  ${v}`));
        }

        if (options.deps) {
          console.log('Dependencies:');
          info.imports.forEach((imp) => console.log(`  ${imp.name}`));
        }
      } else {
        const project = analyzer.analyzeProject();

        if (options.json) {
          printJSON(project);
          return;
        }

        printProjectInfo(project, options.short ? 'short' : 'full');
      }
    });
}
