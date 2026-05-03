import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { printProjectInfo } from '../output/human';
import chalk from 'chalk';
import * as fs from 'fs';

export function watchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch a project and re-analyze on change')
    .option('--info', 'Show info on change')
    .option('--test', 'Run tests on change')
    .option('--debounce <ms>', 'Debounce delay in milliseconds', '300')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const debounceMs = parseInt(options.debounce, 10) || config.watchDebounceMs || 300;

      const skippedFiles = new Set<string>();
      let skipReported = false;

      console.log(chalk.bold.blue('\n[shadow watch]\n'));
      console.log(chalk.gray('Watching for changes... (Ctrl+C to stop)'));
      console.log(chalk.dim(`Debounce: ${debounceMs}ms`));
      console.log('');

      const debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

      const handleChange = (eventType: string, filename: string | null) => {
        if (
          !filename ||
          filename.startsWith('.') ||
          filename.includes('node_modules') ||
          filename.includes('.git/')
        ) {
          return;
        }

        if (debounceTimers.has(filename)) {
          clearTimeout(debounceTimers.get(filename)!);
        }

        debounceTimers.set(filename, setTimeout(() => {
          debounceTimers.delete(filename);
          try {
            console.log(chalk.dim(`\n[${new Date().toLocaleTimeString()}] Changed: ${filename}`));

            if (options.info) {
              const project = analyzer.analyzeProject();
              printProjectInfo(project, 'short');
            } else {
              console.log(chalk.gray(`  File: ${filename}`));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.log(chalk.yellow(`  Warning: could not re-analyze (${msg})`));
          }
        }, debounceMs));
      };

      let watcher: fs.FSWatcher;

      try {
        watcher = fs.watch(process.cwd(), { recursive: true }, handleChange);

        watcher.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EMFILE') {
            if (!skipReported) {
              skipReported = true;
              console.log(chalk.yellow('\n⚠ File descriptor limit reached (EMFILE). Some files may not be watched.'));
              console.log(chalk.dim('  Increase the limit: ulimit -n 4096'));
            }
          } else {
            console.log(chalk.red(`\nWatcher error: ${err.message}`));
          }
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((err as NodeJS.ErrnoException).code === 'EMFILE') {
          console.log(chalk.yellow('\n⚠ File descriptor limit reached. Falling back to polling mode.'));
          console.log(chalk.dim('  Consider increasing limit: ulimit -n 4096'));
          startPolling(handleChange);
        } else {
          console.log(chalk.red(`\nFailed to start watcher: ${msg}`));
        }
      }

      process.on('SIGINT', () => {
        if (watcher) {
          try { watcher.close(); } catch { /* ignore */ }
        }
        for (const timer of debounceTimers.values()) {
          clearTimeout(timer);
        }
        debounceTimers.clear();
        console.log(chalk.gray('\nWatch stopped.'));
        process.exit(0);
      });
    });
}

function startPolling(callback: (eventType: string, filename: string) => void): void {
  let lastMtimes: Map<string, number> = new Map();

  const scanDir = (dir: string) => {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        if (
          entry.name.startsWith('.') ||
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '.git'
        ) continue;

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            const prev = lastMtimes.get(fullPath);
            if (prev !== undefined && stat.mtimeMs !== prev) {
              callback('change', fullPath);
            }
            lastMtimes.set(fullPath, stat.mtimeMs);
          } catch {
            // File may have been deleted
            lastMtimes.delete(fullPath);
          }
        }
      }
    } catch {
      // Directory may be inaccessible
    }
  };

  setInterval(() => {
    scanDir(process.cwd());
  }, 1000);
}
