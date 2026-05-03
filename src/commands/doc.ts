import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, writeFile, findFiles, fileExists } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as path from 'path';

export function docCommand(program: Command): void {
  program
    .command('doc [target]')
    .description('Generate documentation for functions, classes, or project')
    .option('--style <name>', 'Doc style: jsdoc, google, numpy', 'jsdoc')
    .option('--language <lang>', 'Target language')
    .option('--readme', 'Generate or update README')
    .option('--output <path>', 'Write to file')
    .option('--json', 'JSON output')
    .action(async (target, options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);

      if (options.readme) {
        const project = analyzer.analyzeProject();
        const readme = generateReadme(project);

        if (options.json) {
          printJSON({ readme });
          return;
        }

        if (options.output) {
          writeFile(options.output, readme);
          console.log(chalk.green(`README written to ${options.output}`));
        } else {
          console.log(readme);
        }
        return;
      }

      if (target && fileExists(target)) {
        const fileInfo = analyzer.analyzeFile(target);
        const content = readFile(target);
        const lang = fileInfo.language;
        const docs: string[] = [];

        docs.push(`// Documentation for ${fileInfo.path}`);
        docs.push(`// Language: ${lang}`);
        docs.push('');

        for (const fn of fileInfo.functions) {
          docs.push(...generateFunctionDoc(fn, lang, options.style));
          docs.push('');
        }

        for (const cls of fileInfo.classes) {
          docs.push(...generateClassDoc(cls, lang, options.style));
          docs.push('');
        }

        if (options.json) {
          printJSON({ docs, functions: fileInfo.functions, classes: fileInfo.classes });
          return;
        }

        const output = docs.join('\n');
        if (options.output) {
          writeFile(options.output, output);
          console.log(chalk.green(`Documentation written to ${options.output}`));
        } else {
          console.log(chalk.bold.blue('\n[shadow doc]\n'));
          console.log(output);
        }
        return;
      }

      const project = analyzer.analyzeProject();

      if (options.json) {
        printJSON({ project: project.summary, files: project.files.map((f) => ({ path: f.path, functions: f.functions })) });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow doc]\n'));
      console.log(chalk.bold(`Project: ${project.name}`));
      console.log(chalk.dim(`${project.totalFiles} files, language: ${project.language}`));
      console.log('');
      for (const f of project.files.filter((x) => x.functions.length > 0 || x.classes.length > 0)) {
        console.log(chalk.cyan(f.path));
        for (const fn of f.functions) {
          console.log(`  ${chalk.yellow('fn')} ${fn}`);
        }
        for (const cls of f.classes) {
          console.log(`  ${chalk.magenta('class')} ${cls}`);
        }
      }
      console.log('');
    });
}

function generateFunctionDoc(name: string, lang: string, style: string): string[] {
  if (style === 'jsdoc' || style === 'google') {
    return [
      `/**`,
      ` * ${name}`,
      ` *`,
      ` * @description TODO: Add description`,
      ` * @returns {unknown}`,
      ` */`,
      `function ${name}() {}`,
    ];
  }
  if (style === 'numpy') {
    return [
      `def ${name}():`,
      `    """`,
      `    ${name}`,
      ``,
      `    Parameters`,
      `    ----------`,
      ``,
      `    Returns`,
      `    -------`,
      ``,
      `    """`,
      `    pass`,
    ];
  }
  return [];
}

function generateClassDoc(name: string, lang: string, style: string): string[] {
  if (style === 'jsdoc') {
    return [
      `/**`,
      ` * @class ${name}`,
      ` * @description TODO: Add description`,
      ` */`,
      `class ${name} {}`,
    ];
  }
  return [`class ${name}:`, `    """TODO: Add description"""`, `    pass`];
}

function generateReadme(project: { name: string; language: string; summary: string; totalFiles: number; envVars: string[]; entryPoints: string[] }): string {
  const lines: string[] = [];
  lines.push(`# ${project.name}`);
  lines.push('');
  lines.push(project.summary);
  lines.push('');
  lines.push(`## Language`);
  lines.push(`${project.language}`);
  lines.push('');
  lines.push(`## Files`);
  lines.push(`${project.totalFiles} source files`);
  lines.push('');

  if (project.entryPoints.length > 0) {
    lines.push('## Entry Points');
    for (const ep of project.entryPoints) {
      lines.push(`- \`${ep}\``);
    }
    lines.push('');
  }

  if (project.envVars.length > 0) {
    lines.push('## Environment Variables');
    for (const v of project.envVars) {
      lines.push(`- \`${v}\``);
    }
    lines.push('');
  }

  lines.push('## Getting Started');
  lines.push('```bash');
  lines.push('# Install dependencies');
  lines.push('# Run the project');
  lines.push('```');

  return lines.join('\n');
}
