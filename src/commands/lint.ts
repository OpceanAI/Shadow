import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function lintCommand(program: Command): void {
  program
    .command('lint')
    .description('Unified linter for multi-language projects')
    .option('--fix', 'Auto-fix issues where possible')
    .option('--language <lang>', 'Target specific language')
    .option('--rule <name>', 'Check specific rule')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const issues: Array<{ file: string; line: number; rule: string; message: string; severity: string }> = [];

      for (const file of project.files) {
        if (options.language && file.language !== options.language) continue;

        try {
          const content = readFile(file.path);
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            if (line.includes('\t')) {
              issues.push({
                file: file.path, line: lineNum, rule: 'no-tabs',
                message: 'Tab character found, use spaces for indentation',
                severity: 'warning',
              });
            }

            if (line.endsWith('  ') || line.endsWith('\t')) {
              issues.push({
                file: file.path, line: lineNum, rule: 'trailing-whitespace',
                message: 'Trailing whitespace',
                severity: 'info',
              });
            }

            if (line.length > 120 && !line.startsWith('import') && !line.startsWith('from') && !line.includes('http')) {
              issues.push({
                file: file.path, line: lineNum, rule: 'max-line-length',
                message: `Line exceeds 120 characters (${line.length})`,
                severity: 'warning',
              });
            }

            if (/\bvar\b\s+\w+/.test(line) && (file.language === 'typescript' || file.language === 'javascript')) {
              issues.push({
                file: file.path, line: lineNum, rule: 'no-var',
                message: 'Use const or let instead of var',
                severity: 'warning',
              });
            }

            if (/==(?!=)/.test(line) && !/typeof/.test(line) && (file.language === 'typescript' || file.language === 'javascript')) {
              issues.push({
                file: file.path, line: lineNum, rule: 'eqeqeq',
                message: 'Use === instead of ==',
                severity: 'warning',
              });
            }

            if (/console\.(log|error|warn|info)\(/.test(line)) {
              issues.push({
                file: file.path, line: lineNum, rule: 'no-console',
                message: 'Console statement found',
                severity: 'info',
              });
            }

            if (/(TODO|FIXME|HACK|XXX)/.test(line)) {
              const match = line.match(/(TODO|FIXME|HACK|XXX)/);
              issues.push({
                file: file.path, line: lineNum, rule: 'no-todo',
                message: `${match?.[0]} comment found`,
                severity: 'info',
              });
            }

            if (file.language === 'python' && /^\s*def\s+\w+/.test(line) && !/"""/.test(line) && i + 1 < lines.length && !/"""/.test(lines[i + 1]) && !/^\s*#/.test(lines[i + 1])) {
              issues.push({
                file: file.path, line: lineNum, rule: 'missing-docstring',
                message: 'Function missing docstring',
                severity: 'info',
              });
            }

            if ((file.language === 'typescript' || file.language === 'javascript') && /\bany\b/.test(line) && !/['"]any['"]/.test(line)) {
              issues.push({
                file: file.path, line: lineNum, rule: 'no-explicit-any',
                message: 'Avoid using the "any" type',
                severity: 'warning',
              });
            }
          }

          if (content.endsWith('\n\n') || content.endsWith('\r\n\r\n')) {
            issues.push({
              file: file.path, line: lines.length, rule: 'no-multiple-empty-lines',
              message: 'File ends with multiple empty lines',
              severity: 'info',
            });
          }
        } catch {
          // skip unreadable files
        }
      }

      let filtered = issues;
      if (options.rule) {
        filtered = issues.filter((i) => i.rule === options.rule);
      }

      if (options.json) {
        printJSON({ issues: filtered, total: filtered.length });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow lint]\n'));

      if (filtered.length === 0) {
        console.log(chalk.green('No lint issues found.'));
      } else {
        const bySeverity: Record<string, typeof filtered> = {};
        for (const i of filtered) {
          (bySeverity[i.severity] = bySeverity[i.severity] || []).push(i);
        }

        for (const sev of ['warning', 'info']) {
          const items = bySeverity[sev];
          if (!items || items.length === 0) continue;
          const color = sev === 'warning' ? chalk.yellow : chalk.gray;
          for (const item of items) {
            console.log(`  ${color('•')} ${item.message} ${chalk.dim(`[${item.rule}]`)}`);
            console.log(`    ${chalk.dim(item.file)}:${item.line}`);
          }
        }

        console.log(`\n${chalk.dim(`Total: ${filtered.length} issue(s)`)}`);
        if (options.fix) {
          console.log(chalk.dim('Run with --fix for auto-fixable issues (not yet implemented)'));
        }
      }
      console.log('');
    });
}
