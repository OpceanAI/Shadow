import { Command } from 'commander';
import { readFile, writeFile, findFiles } from '../utils/fs';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function migrateCommand(program: Command): void {
  program
    .command('migrate')
    .description('Migration assistant for framework versions')
    .option('--from <version>', 'Current version')
    .option('--to <version>', 'Target version')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const suggestions: string[] = [];

      if (project.language === 'typescript' || project.language === 'javascript') {
        suggestions.push(...checkTSMigrations(project, options.from, options.to));
      } else if (project.language === 'python') {
        suggestions.push(...checkPythonMigrations(project, options.from, options.to));
      }

      if (options.json) {
        printJSON({ language: project.language, suggestions });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow migrate]\n'));

      if (options.from && options.to) {
        console.log(chalk.bold(`Migration: ${options.from} → ${options.to}`));
      }

      if (suggestions.length === 0) {
        console.log(chalk.green('No migrations detected.'));
      } else {
        for (const s of suggestions) {
          console.log(`  ${chalk.yellow('→')} ${s}`);
        }
      }
      console.log('');
    });
}

function checkTSMigrations(project: ReturnType<Analyzer['analyzeProject']>, from: string, to: string): string[] {
  const suggestions: string[] = [];

  for (const file of project.files) {
    try {
      const content = readFile(file.path);

      if (/import\s+.*reactive/.test(content)) {
        suggestions.push(`${file.path}: Vue reactivity API may need updating`);
      }

      if (/(?:angular|@angular)\/core/.test(content)) {
        suggestions.push(`${file.path}: Angular detected - check for breaking changes in your target version`);
      }

      if (/React\.createClass/.test(content)) {
        suggestions.push(`${file.path}: Deprecated React.createClass found - migrate to class or functional component`);
      }

      if (/dangerouslySetInnerHTML/.test(content)) {
        suggestions.push(`${file.path}: Consider safer alternatives to dangerouslySetInnerHTML`);
      }
    } catch {
      // skip
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('No specific migration patterns detected for TypeScript/JavaScript');
  }

  return suggestions;
}

function checkPythonMigrations(project: ReturnType<Analyzer['analyzeProject']>, from: string, to: string): string[] {
  const suggestions: string[] = [];

  for (const file of project.files) {
    try {
      const content = readFile(file.path);

      if (/(?:import|from)\s+typing\b/.test(content) && /\bDict\b|\bList\b|\bTuple\b/.test(content)) {
        suggestions.push(`${file.path}: Python 3.9+ supports built-in generics (dict/list/tuple instead of Dict/List/Tuple)`);
      }

      if (/setup\.py/.test(file.path)) {
        suggestions.push(`${file.path}: Consider migrating from setup.py to pyproject.toml`);
      }

      if (/import\s+distutils/.test(content)) {
        suggestions.push(`${file.path}: distutils is deprecated in Python 3.10+`);
      }

      if (/collections\.(MutableMapping|Mapping|Sequence)/.test(content)) {
        suggestions.push(`${file.path}: collections.Mapping/etc moved to collections.abc in Python 3.3+`);
      }
    } catch {
      // skip
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('No specific migration patterns detected for Python');
  }

  return suggestions;
}
