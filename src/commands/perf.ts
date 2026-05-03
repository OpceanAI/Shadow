import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function perfCommand(program: Command): void {
  program
    .command('perf')
    .description('Performance bottleneck detection')
    .option('--memory', 'Memory usage analysis')
    .option('--cpu', 'CPU-bound patterns')
    .option('--io', 'I/O-bound patterns')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const checkAll = !options.memory && !options.cpu && !options.io;
      const patterns: Array<{ file: string; line: number; pattern: string; description: string; fix: string }> = [];

      for (const file of project.files) {
        try {
          const content = readFile(file.path);
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            if ((checkAll || options.cpu) && /for\s*\(.*\.length\s*;/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'loop-length',
                description: 'Loop with .length in condition (recalculated each iteration)',
                fix: 'Cache .length in a variable before loop',
              });
            }

            if ((checkAll || options.cpu) && /\.forEach\(/.test(line) && /await/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'sequential-async',
                description: 'await inside forEach (sequential execution)',
                fix: 'Use for...of or Promise.all for parallel execution',
              });
            }

            if ((checkAll || options.memory) && /new\s+Array\s*\(\s*\d{4,}\s*\)/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'large-array',
                description: 'Large array pre-allocation detected',
                fix: 'Consider lazy initialization or streaming',
              });
            }

            if ((checkAll || options.io) && /readFileSync|writeFileSync|existsSync|statSync/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'sync-io',
                description: 'Synchronous file I/O detected',
                fix: 'Use async versions (readFile, writeFile) for better throughput',
              });
            }

            if ((checkAll || options.io) && /execSync|execFileSync/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'sync-exec',
                description: 'Synchronous process execution',
                fix: 'Use exec/execFile with async/await or spawn',
              });
            }

            if ((checkAll || options.memory) && /JSON\.parse\([^)]{100,}\)/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'large-json',
                description: 'Large inline JSON parse may cause memory spike',
                fix: 'Stream parse or load from file',
              });
            }

            if ((checkAll || options.cpu) && /\.map\(.*\)\.filter\(/.test(line) || /\.filter\(.*\)\.map\(/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'double-iteration',
                description: 'Chained map/filter iterates twice',
                fix: 'Use .reduce() or single-pass iteration',
              });
            }

            if ((checkAll || options.io) && /open\(['"](?!.*https?:\/\/)/.test(line)) {
              patterns.push({
                file: file.path, line: lineNum, pattern: 'file-open',
                description: 'File open without explicit close in try/finally',
                fix: 'Use with-context or ensure close in finally block',
              });
            }
          }
        } catch {
          // skip unreadable files
        }
      }

      if (options.json) {
        printJSON({ patterns, total: patterns.length });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow perf]\n'));

      if (patterns.length === 0) {
        console.log(chalk.green('No performance issues detected.'));
      } else {
        for (const p of patterns) {
          console.log(`${chalk.yellow('⚠')} ${p.description}`);
          console.log(`  ${chalk.dim(p.file)}:${p.line}`);
          console.log(`  ${chalk.green('Fix:')} ${p.fix}`);
          console.log('');
        }

        console.log(chalk.dim(`Total: ${patterns.length} pattern(s)`));
      }
      console.log('');
    });
}
