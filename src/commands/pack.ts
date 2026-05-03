import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, writeFile, findFiles, fileExists } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as path from 'path';

export function packCommand(program: Command): void {
  program
    .command('pack')
    .description('Pack codebase into AI-friendly format')
    .option('--include <patterns>', 'Include patterns (comma-separated)')
    .option('--exclude <patterns>', 'Exclude patterns (comma-separated)')
    .option('--remote <url>', 'Remote repository URL')
    .option('--format <fmt>', 'Output format: xml, markdown, plain', 'markdown')
    .option('--output <path>', 'Write to file')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();

      const includePatterns = options.include
        ? options.include.split(',').map((s: string) => s.trim())
        : null;
      const excludePatterns = options.exclude
        ? options.exclude.split(',').map((s: string) => s.trim())
        : ['node_modules', '.git', 'dist', '__pycache__', '.venv', '.shadow'];

      let files = project.files;

      if (includePatterns) {
        files = files.filter((f) =>
          includePatterns.some((p: string) => f.path.includes(p.replace(/\*/g, ''))),
        );
      }

      files = files.filter((f) =>
        !excludePatterns.some((p: string) => f.path.includes(p)),
      );

      const format = options.format || 'markdown';
      let output = '';

      if (format === 'markdown') {
        output = generateMarkdownPack(project, files);
      } else if (format === 'xml') {
        output = generateXMLPack(project, files);
      } else {
        output = generatePlainPack(project, files);
      }

      if (options.json) {
        printJSON({ files: files.length, format, size: output.length });
        return;
      }

      if (options.output) {
        writeFile(options.output, output);
        console.log(chalk.green(`Codebase packed to ${options.output} (${files.length} files, ${(output.length / 1024).toFixed(1)} KB)`));
      } else {
        console.log(chalk.bold.blue(`\n[shadow pack] ${format}\n`));
        console.log(chalk.dim(`${files.length} files, ${(output.length / 1024).toFixed(1)} KB\n`));
        console.log(output);
      }
    });
}

function generateMarkdownPack(project: ReturnType<Analyzer['analyzeProject']>, files: Array<{ path: string }>): string {
  const lines: string[] = [];
  lines.push(`# ${project.name}`);
  lines.push('');
  lines.push(`> ${project.summary}`);
  lines.push('');
  lines.push(`## Files (${files.length})`);
  lines.push('');

  const treeLines = generateFileTree(files.map((f) => f.path));
  lines.push('```');
  lines.push(...treeLines);
  lines.push('```');
  lines.push('');

  for (const file of files) {
    lines.push(`### \`${file.path}\``);
    lines.push('');
    try {
      const content = readFile(file.path);
      const ext = path.extname(file.path).replace('.', '');
      const langMap: Record<string, string> = {
        ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        py: 'python', rs: 'rust', go: 'go', sh: 'bash', json: 'json',
        yaml: 'yaml', yml: 'yaml', toml: 'toml', md: 'markdown',
      };
      const lang = langMap[ext] || ext;
      lines.push('```' + lang);
      lines.push(content);
      lines.push('```');
      lines.push('');
    } catch {
      lines.push('```');
      lines.push('// Could not read file');
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateXMLPack(project: ReturnType<Analyzer['analyzeProject']>, files: Array<{ path: string }>): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<codebase name="${escapeXml(project.name)}" language="${project.language}">`);
  lines.push(`  <summary>${escapeXml(project.summary)}</summary>`);
  lines.push(`  <files count="${files.length}">`);

  for (const file of files) {
    lines.push(`    <file path="${escapeXml(file.path)}">`);
    try {
      const content = readFile(file.path);
      lines.push(`      <![CDATA[${content}]]>`);
    } catch {
      lines.push('      <error>Could not read file</error>');
    }
    lines.push('    </file>');
  }

  lines.push('  </files>');
  lines.push('</codebase>');
  return lines.join('\n');
}

function generatePlainPack(project: ReturnType<Analyzer['analyzeProject']>, files: Array<{ path: string }>): string {
  const lines: string[] = [];
  lines.push(`=== ${project.name} ===`);
  lines.push(project.summary);
  lines.push('');

  for (const file of files) {
    lines.push(`--- ${file.path} ---`);
    try {
      lines.push(readFile(file.path));
    } catch {
      lines.push('[Could not read file]');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function generateFileTree(paths: string[]): string[] {
  const tree: Record<string, unknown> = {};
  for (const p of paths) {
    const parts = p.split('/');
    let node = tree;
    for (const part of parts) {
      if (!node[part]) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
  }

  const lines: string[] = [];
  buildTree(tree, '', lines);
  return lines;
}

function buildTree(node: Record<string, unknown>, prefix: string, lines: string[]): void {
  const entries = Object.entries(node);
  entries.forEach(([key, value], i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const isDir = Object.keys(value as Record<string, unknown>).length > 0;
    lines.push(prefix + connector + key + (isDir ? '/' : ''));
    if (isDir) {
      buildTree(value as Record<string, unknown>, prefix + (isLast ? '    ' : '│   '), lines);
    }
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
