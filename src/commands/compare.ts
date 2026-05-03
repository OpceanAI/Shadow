import { Command } from 'commander';
import { readFile } from '../utils/fs';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function compareCommand(program: Command): void {
  program
    .command('compare <file1> <file2>')
    .description('Compare two files structurally')
    .option('--json', 'JSON output')
    .action(async (file1, file2, options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);

      try {
        const info1 = analyzer.analyzeFile(file1);
        const info2 = analyzer.analyzeFile(file2);

        const addedFunctions = info2.functions.filter((f) => !info1.functions.includes(f));
        const removedFunctions = info1.functions.filter((f) => !info2.functions.includes(f));
        const commonFunctions = info1.functions.filter((f) => info2.functions.includes(f));

        const addedClasses = info2.classes.filter((c) => !info1.classes.includes(c));
        const removedClasses = info1.classes.filter((c) => !info2.classes.includes(c));

        const addedImports = info2.imports.filter((i) => !info1.imports.some((x) => x.name === i.name));
        const removedImports = info1.imports.filter((i) => !info2.imports.some((x) => x.name === i.name));

        const addedEnvVars = info2.envVars.filter((v) => !info1.envVars.includes(v));
        const removedEnvVars = info1.envVars.filter((v) => !info2.envVars.includes(v));

        if (options.json) {
          printJSON({
            file1: info1.path, file2: info2.path,
            functions: { added: addedFunctions, removed: removedFunctions, common: commonFunctions },
            classes: { added: addedClasses, removed: removedClasses },
            imports: { added: addedImports.map((i) => i.name), removed: removedImports.map((i) => i.name) },
            envVars: { added: addedEnvVars, removed: removedEnvVars },
          });
          return;
        }

        console.log(chalk.bold.blue('\n[shadow compare]\n'));
        console.log(chalk.bold(`${info1.path}  vs  ${info2.path}`));
        console.log(`  Language: ${info1.language} → ${info2.language}`);
        console.log('');

        if (addedFunctions.length > 0) {
          console.log(chalk.green(`+ ${addedFunctions.length} functions added:`));
          addedFunctions.forEach((f) => console.log(`  ${chalk.green('+')} ${f}`));
          console.log('');
        }
        if (removedFunctions.length > 0) {
          console.log(chalk.red(`- ${removedFunctions.length} functions removed:`));
          removedFunctions.forEach((f) => console.log(`  ${chalk.red('-')} ${f}`));
          console.log('');
        }
        if (commonFunctions.length > 0) {
          console.log(chalk.dim(`~ ${commonFunctions.length} functions unchanged`));
          console.log('');
        }
        if (addedClasses.length > 0) {
          console.log(chalk.green(`+ ${addedClasses.length} classes added:`));
          addedClasses.forEach((c) => console.log(`  ${chalk.green('+')} ${c}`));
          console.log('');
        }
        if (addedImports.length > 0) {
          console.log(chalk.green(`+ ${addedImports.length} imports added:`));
          addedImports.forEach((imp) => console.log(`  ${chalk.green('+')} ${imp.name}`));
          console.log('');
        }
        if (addedEnvVars.length > 0 || removedEnvVars.length > 0) {
          console.log(chalk.yellow('Environment variable changes:'));
          addedEnvVars.forEach((v) => console.log(`  ${chalk.green('+')} ${v}`));
          removedEnvVars.forEach((v) => console.log(`  ${chalk.red('-')} ${v}`));
          console.log('');
        }
      } catch {
        console.log(chalk.red('Could not read one or both files.'));
      }
    });
}
