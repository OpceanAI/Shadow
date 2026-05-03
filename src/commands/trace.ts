import { Command } from 'commander';
import { Tracer } from '../core/tracer';
import { TraceDomain } from '../types';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function traceCommand(program: Command): void {
  program
    .command('trace [command...]')
    .description('Trace a program while it runs')
    .option('--network', 'Trace network calls')
    .option('--fs', 'Trace file system operations')
    .option('--env', 'Trace environment variable access')
    .option('--spawn', 'Trace child processes')
    .option('--raw', 'Raw output')
    .option('--json', 'JSON output')
    .action(async (cmdArgs, options) => {
      const domains: TraceDomain[] = [];

      if (options.network) domains.push('network');
      if (options.fs) domains.push('fs');
      if (options.env) domains.push('env');
      if (options.spawn) domains.push('spawn');

      if (domains.length === 0) domains.push('all');

      if (!cmdArgs || cmdArgs.length === 0) {
        console.log(chalk.yellow('Usage: shadow trace <command> [args...]'));
        console.log('Example: shadow trace python app.py');
        return;
      }

      const tracer = new Tracer(domains);
      const [cmd, ...args] = cmdArgs;
      const result = await tracer.traceCommand(cmd, args);

      if (options.json) {
        printJSON(result);
        return;
      }

      if (options.raw) {
        result.events.forEach((e) => console.log(`[${e.type}] ${e.detail}`));
      } else {
        console.log(chalk.bold.blue('\n[shadow trace]\n'));
        console.log(chalk.bold(`Duration: ${result.duration}ms`));
        console.log(chalk.bold(`Exit code: ${result.exitCode}`));
        console.log(chalk.bold(`Events: ${result.events.length}`));

        if (result.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          result.errors.forEach((e) => console.log(`  ${chalk.red('✗')} ${e}`));
        }

        const grouped = groupBy(result.events, 'type');
        for (const [type, events] of Object.entries(grouped)) {
          console.log(chalk.bold(`\n${type}:`));
          events.slice(0, 10).forEach((e) => {
            const value = e.masked ? '***' : e.value || '';
            console.log(`  ${chalk.dim(e.detail)} ${chalk.cyan(value)}`);
          });
          if (events.length > 10) {
            console.log(chalk.dim(`  ... and ${events.length - 10} more`));
          }
        }
      }
    });
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}
