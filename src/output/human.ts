import chalk from 'chalk';
import { ProjectInfo, FileInfo, DependencyGraph, ImportInfo } from '../types';
import { Theme, getTheme } from './theme';

let currentTheme: Theme = getTheme('dark');
let useEmoji: boolean = false;
let verbose: boolean = false;

export function setTheme(theme: Theme): void {
  currentTheme = theme;
}

export function setEmoji(enabled: boolean): void {
  useEmoji = enabled;
}

export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

export function getCurrentTheme(): Theme {
  return currentTheme;
}

function icon(type: keyof Theme['emoji']): string {
  return useEmoji ? currentTheme.emoji[type] : currentTheme.symbols[type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'] || '';
}

export function printProjectInfo(info: ProjectInfo, format: 'short' | 'full' = 'full'): void {
  if (format === 'short') {
    console.log(chalk.bold(info.summary));
    return;
  }

  const prefix = useEmoji ? currentTheme.emoji.info + ' ' : '';
  console.log(`\n${chalk.bold.blue(`${prefix}[shadow]`)}`);

  if (verbose) {
    console.log(chalk.dim(`  Root: ${info.rootPath}`));
    console.log(chalk.dim(`  Language: ${info.language}`));
    console.log(chalk.dim(`  Files: ${info.totalFiles}`));
  }

  const allImports = info.files.flatMap((f) => f.imports);
  const externalImports = [...new Set(
    allImports.filter((i) => i.type === 'external').map((i) => i.name),
  )];
  const internalImports = [...new Set(
    allImports.filter((i) => i.type === 'internal').map((i) => i.name),
  )];

  if (externalImports.length > 0) {
    console.log();
    console.log(chalk.bold(`Imports:`));
    externalImports.forEach((imp) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${imp}`));
  }

  const internalFiles = [...new Set(
    info.files
      .filter((f) => f.imports.some((i) => i.type === 'internal'))
      .map((f) => f.path.split('/').pop() || f.path),
  )];

  if (internalFiles.length > 0) {
    console.log();
    console.log(chalk.bold('Connections:'));
    internalFiles.forEach((f) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${f}`));
  }

  if (info.envVars.length > 0) {
    console.log();
    console.log(chalk.bold(`${icon('key')} Environment:`));
    info.envVars.forEach((v) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${v}`));
  }

  if (info.externalAPIs.length > 0) {
    console.log();
    console.log(chalk.bold(`${icon('link')} External calls:`));
    info.externalAPIs.forEach((api) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${api}`));
  }

  if (verbose) {
    console.log();
    console.log(chalk.bold('Entry points:'));
    info.entryPoints.forEach((ep) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${ep}`));

    if (info.files.length > 0) {
      console.log();
      console.log(chalk.bold('Files:'));
      info.files.forEach((f) => console.log(`  ${currentTheme.symbols.bullet} ${f.path} ${chalk.dim(`(${f.language}, ${f.functions.length} fn)`)}`));
    }
  }

  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(info.summary);
  console.log();
}

export function printFileInfo(info: FileInfo): void {
  const prefix = useEmoji ? currentTheme.emoji.info + ' ' : '';
  console.log(`\n${chalk.bold.blue(`${prefix}[shadow]`)}`);

  if (verbose) {
    console.log(chalk.dim(`  Language: ${info.language}`));
    console.log(chalk.dim(`  Purpose: ${info.purpose}`));
  }

  const externalImports = info.imports.filter((i) => i.type === 'external');
  const internalImports = info.imports.filter((i) => i.type === 'internal');

  if (info.imports.length > 0) {
    console.log();
    console.log(chalk.bold('Imports:'));
    info.imports.forEach((imp) =>
      console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${imp.name}${imp.type === 'internal' ? chalk.dim(' (internal)') : ''}`),
    );
  }

  if (internalImports.length > 0) {
    console.log();
    console.log(chalk.bold('Connections:'));
    internalImports.forEach((imp) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${imp.name}`));
  }

  if (info.envVars.length > 0) {
    console.log();
    console.log(chalk.bold(`${icon('key')} Environment:`));
    info.envVars.forEach((v) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${v}`));
  }

  if (info.externalCalls.length > 0) {
    console.log();
    console.log(chalk.bold(`${icon('link')} External calls:`));
    info.externalCalls.forEach((c) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${c}`));
  }

  if (verbose && info.functions.length > 0) {
    console.log();
    console.log(chalk.bold('Functions:'));
    info.functions.forEach((fn) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${fn}`));
  }

  if (verbose && info.classes.length > 0) {
    console.log();
    console.log(chalk.bold('Classes:'));
    info.classes.forEach((cls) => console.log(`  ${chalk.cyan(currentTheme.symbols.arrow)} ${cls}`));
  }

  const parts: string[] = [];
  if (info.functions.length > 0) parts.push(`${info.functions.length} functions`);
  if (info.classes.length > 0) parts.push(`${info.classes.length} classes`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  console.log();
  console.log(chalk.bold('Summary:'));
  console.log(`${info.language} file${detail}`);
  console.log();
}

export function printGraphText(graph: DependencyGraph): void {
  const prefix = useEmoji ? currentTheme.emoji.graph + ' ' : '';
  console.log(`\n${chalk.bold.blue(`${prefix}[shadow graph]`)}\n`);
  for (const edge of graph.edges) {
    const fromLabel = graph.nodes.find((n) => n.id === edge.from)?.label || edge.from;
    const toLabel = graph.nodes.find((n) => n.id === edge.to)?.label || edge.to;
    console.log(`  ${chalk.cyan(fromLabel)} ${chalk.dim('→')} ${chalk.green(toLabel)} ${chalk.dim(`(${edge.type})`)}`);
  }
  console.log('');
}

export function printError(message: string): void {
  const prefix = useEmoji ? currentTheme.emoji.error + ' ' : '';
  console.error(`${prefix}${chalk.red.bold(currentTheme.symbols.error)} ${chalk.red(message)}`);
}

export function printSuccess(message: string): void {
  const prefix = useEmoji ? currentTheme.emoji.success + ' ' : '';
  console.log(`${prefix}${chalk.green.bold(currentTheme.symbols.success)} ${chalk.green(message)}`);
}

export function printWarning(message: string): void {
  const prefix = useEmoji ? currentTheme.emoji.warning + ' ' : '';
  console.warn(`${prefix}${chalk.yellow.bold(currentTheme.symbols.warning)} ${chalk.yellow(message)}`);
}

export function highlightCode(code: string, language?: string): string {
  const lines = code.split('\n');
  const highlighted = lines.map((line, index) => {
    let result = line
      .replace(
        /\b(function|const|let|var|if|else|for|while|return|import|export|class|interface|type|enum|default|async|await|yield|try|catch|throw|new|extends|implements|static|public|private|protected|readonly)\b/g,
        chalk.magenta('$1')
      )
      .replace(
        /\b(true|false|null|undefined|void|never|any|string|number|boolean)\b/g,
        chalk.yellow('$1')
      )
      .replace(
        /(['"`])(?:(?!\1|\\).|\\.)*\1/g,
        chalk.green('$&')
      )
      .replace(
        /\/\/.*$/g,
        chalk.dim('$&')
      )
      .replace(
        /\b(\d+(?:\.\d+)?(?:e\d+)?)\b/g,
        chalk.yellow('$1')
      );

    const lineNum = String(index + 1).padStart(3, ' ');
    return `${chalk.dim(lineNum + ' │')} ${result}`;
  });

  return highlighted.join('\n');
}

export function printCodeSnippet(code: string, language?: string): void {
  console.log(chalk.dim(currentTheme.symbols.separator.repeat(60)));
  console.log(highlightCode(code, language));
  console.log(chalk.dim(currentTheme.symbols.separator.repeat(60)));
}

export function printSectionHeader(title: string): void {
  const prefix = useEmoji ? currentTheme.emoji.info + ' ' : '';
  console.log(`\n${chalk.bold.blue(`${prefix}${title}`)}`);
}

export function printDivider(): void {
  console.log(chalk.dim(currentTheme.symbols.separator.repeat(process.stdout.columns || 80)));
}
