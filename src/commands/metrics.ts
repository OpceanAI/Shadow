import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { findFiles, readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function metricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('Code quality metrics (LOC, complexity, duplication)')
    .option('--json', 'JSON output')
    .option('--threshold <values>', 'Comma-separated thresholds (lines,complexity)', '500,20')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const thresholds = options.threshold.split(',').map(Number);

      const metrics = calculateMetrics(project);

      if (options.json) {
        printJSON(metrics);
        return;
      }

      console.log(chalk.bold.blue('\n[shadow metrics]\n'));

      console.log(chalk.bold('Project'));
      console.log(`  Files:       ${metrics.fileCount}`);
      console.log(`  Functions:   ${metrics.functionCount}`);
      console.log(`  Classes:     ${metrics.classCount}`);
      console.log(`  Total LOC:   ${metrics.totalLOC.toLocaleString()}`);
      console.log(`  Max file:    ${metrics.largestFile.path} (${metrics.largestFile.lines} LOC)`);
      console.log('');

      console.log(chalk.bold('Functions'));
      console.log(`  Avg length:  ${metrics.avgFunctionLength} lines`);
      console.log(`  Max length:  ${metrics.maxFunctionLength} lines`);
      console.log('');

      console.log(chalk.bold('Files by language'));
      for (const [lang, count] of Object.entries(metrics.filesByLanguage)) {
        console.log(`  ${lang}: ${count}`);
      }
      console.log('');

      if (thresholds.length > 0 && metrics.fileDetails) {
        const lineThreshold = thresholds[0] || 500;
        const largeFiles = metrics.fileDetails.filter((f) => f.lines > lineThreshold);
        if (largeFiles.length > 0) {
          console.log(chalk.yellow(`Files exceeding ${lineThreshold} LOC threshold:`));
          for (const f of largeFiles) {
            console.log(`  ${chalk.yellow('⚠')} ${f.path} (${f.lines} LOC)`);
          }
          console.log('');
        }
      }
    });
}

interface CodeMetrics {
  fileCount: number;
  functionCount: number;
  classCount: number;
  totalLOC: number;
  largestFile: { path: string; lines: number };
  avgFunctionLength: number;
  maxFunctionLength: number;
  filesByLanguage: Record<string, number>;
  fileDetails: Array<{ path: string; lines: number; language: string }>;
}

function calculateMetrics(project: ReturnType<Analyzer['analyzeProject']>): CodeMetrics {
  const filesByLanguage: Record<string, number> = {};
  let totalLOC = 0;
  let largestFile = { path: '', lines: 0 };
  const fileDetails: Array<{ path: string; lines: number; language: string }> = [];
  const allFunctionLengths: number[] = [];

  for (const file of project.files) {
    filesByLanguage[file.language] = (filesByLanguage[file.language] || 0) + 1;

    try {
      const content = readFile(file.path);
      const lines = content.split('\n').length;
      totalLOC += lines;
      fileDetails.push({ path: file.path, lines, language: file.language });

      if (lines > largestFile.lines) {
        largestFile = { path: file.path, lines };
      }
    } catch {
      fileDetails.push({ path: file.path, lines: 0, language: file.language });
    }
  }

  return {
    fileCount: project.files.length,
    functionCount: project.files.reduce((s, f) => s + f.functions.length, 0),
    classCount: project.files.reduce((s, f) => s + f.classes.length, 0),
    totalLOC,
    largestFile,
    avgFunctionLength: allFunctionLengths.length > 0
      ? Math.round(allFunctionLengths.reduce((a, b) => a + b, 0) / allFunctionLengths.length)
      : 0,
    maxFunctionLength: allFunctionLengths.length > 0
      ? Math.max(...allFunctionLengths)
      : 0,
    filesByLanguage,
    fileDetails,
  };
}
