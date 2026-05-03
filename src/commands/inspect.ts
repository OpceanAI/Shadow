import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { isSecretVar } from '../utils/env';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function inspectCommand(program: Command): void {
  program
    .command('inspect')
    .description('Inspect sensitive or structural parts of a project')
    .option('--env', 'Environment variables')
    .option('--imports', 'All imports')
    .option('--calls', 'External calls')
    .option('--sensitive', 'Sensitive items only')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();

      console.log(chalk.bold.blue('\n[shadow inspect]\n'));

      if (options.env) {
        console.log(chalk.bold('Environment variables:'));
        for (const v of project.envVars) {
          const sensitive = isSecretVar(v) ? chalk.red(' [SENSITIVE]') : '';
          console.log(`  ${chalk.cyan('↳')} ${v}${sensitive}`);
        }
      }

      if (options.imports) {
        console.log(chalk.bold('\nImports:'));
        const allImports = project.files.flatMap((f) => f.imports);
        const uniqueImports = [...new Set(allImports.map((i) => i.name))];
        uniqueImports.forEach((imp) => console.log(`  ${chalk.cyan('↳')} ${imp}`));
      }

      if (options.calls) {
        console.log(chalk.bold('\nExternal calls:'));
        project.externalAPIs.forEach((api) =>
          console.log(`  ${chalk.cyan('↳')} ${api}`),
        );
      }

      if (options.sensitive) {
        console.log(chalk.bold('\nSensitive items:'));
        const secrets = project.envVars.filter(isSecretVar);
        if (secrets.length > 0) {
          secrets.forEach((s) =>
            console.log(`  ${chalk.red('⚠')} ${s} (secret value masked)`),
          );
        } else {
          console.log(chalk.green('  No sensitive items detected.'));
        }
      }

      if (!options.env && !options.imports && !options.calls && !options.sensitive) {
        console.log(chalk.yellow('Use flags to focus: --env, --imports, --calls, --sensitive'));
      }

      if (options.json) {
        printJSON({
          envVars: project.envVars,
          imports: project.files.flatMap((f) => f.imports.map((i) => i.name)),
          externalCalls: project.externalAPIs,
          sensitive: project.envVars.filter(isSecretVar),
        });
      }

      console.log('');
    });
}
