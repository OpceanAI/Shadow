import { readFile, findFiles } from '../utils/fs';
import { runCommandSafe } from '../utils/process';
import chalk from 'chalk';

export interface MetricSnapshot {
  date: string;
  commit: string;
  totalFiles: number;
  totalLOC: number;
  totalFunctions: number;
  totalClasses: number;
  complexity: number;
  fileChurn: Record<string, number>;
}

export interface TrendData {
  metric: string;
  values: Array<{ date: string; value: number }>;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number;
}

export interface TrendPrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  monthsAhead: number;
  confidence: number;
  recommendation: string;
}

export interface TrendReport {
  snapshots: MetricSnapshot[];
  trends: TrendData[];
  predictions: TrendPrediction[];
  hotFiles: Array<{ file: string; churn: number; trend: string }>;
}

export class TrendAnalyzer {
  analyze(projectPath?: string): TrendReport {
    const root = projectPath || process.cwd();

    const snapshots = this.collectSnapshots(root);

    const trends: TrendData[] = [];
    if (snapshots.length >= 2) {
      trends.push(this.computeTrend('Total LOC', snapshots, (s) => s.totalLOC));
      trends.push(this.computeTrend('Total Files', snapshots, (s) => s.totalFiles));
      trends.push(this.computeTrend('Complexity', snapshots, (s) => s.complexity));
      trends.push(this.computeTrend('Functions', snapshots, (s) => s.totalFunctions));
    }

    const predictions = this.makePredictions(trends);
    const hotFiles = this.findHotFiles();

    return {
      snapshots,
      trends,
      predictions,
      hotFiles,
    };
  }

  private collectSnapshots(root: string): MetricSnapshot[] {
    const snapshots: MetricSnapshot[] = [];

    try {
      // Try to get git log with stats
      const result = runCommandSafe('git', ['log', '--format=%H %ai', '--max-count=10', '--', '.'], root);

      if (result.exitCode === 0 && result.stdout) {
        const lines = result.stdout.split('\n').filter(Boolean);

        for (const line of lines) {
          const parts = line.split(' ');
          const commit = parts[0];
          const date = parts.slice(1, 4).join('-');

          // Get stats for this commit
          const statResult = runCommandSafe(
            'git',
            ['show', '--stat', '--format=', commit],
            root,
          );

          const statLines = (statResult.stdout || '').split('\n').filter(Boolean);
          let totalLOC = 0;
          let changedFiles = 0;

          for (const sl of statLines) {
            const match = sl.match(/(\d+)\s+(?:insertion|addition|change)s?\(\+\)/);
            if (match) totalLOC += parseInt(match[1], 10);

            const changedMatch = sl.match(/(\d+)\s+(?:files?)\s+changed/);
            if (changedMatch) changedFiles = parseInt(changedMatch[1], 10);
          }

          snapshots.push({
            date: date.split(' ')[0],
            commit: commit.slice(0, 7),
            totalFiles: changedFiles,
            totalLOC,
            totalFunctions: 0,
            totalClasses: 0,
            complexity: 0,
            fileChurn: {},
          });
        }
      }
    } catch {
      // git not available or error
    }

    // Add current snapshot based on files
    try {
      const files = findFiles(root, ['*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs']);
      let totalLOC = 0;
      let totalFunctions = 0;
      let totalClasses = 0;
      let totalComplexity = 0;

      for (const file of files) {
        try {
          const content = readFile(file);
          const lines = content.split('\n').length;
          totalLOC += lines;

          const fnMatches = content.match(/(?:function |=>|def |func )/g);
          if (fnMatches) totalFunctions += fnMatches.length;

          const classMatches = content.match(/class\s+\w+/g);
          if (classMatches) totalClasses += classMatches.length;

          const complexityMatches = content.match(/\b(?:if|else|for|while|switch|case|catch)\b/g);
          if (complexityMatches) totalComplexity += complexityMatches.length;
        } catch {
          // skip
        }
      }

      const now = new Date().toISOString().split('T')[0];
      snapshots.push({
        date: now,
        commit: 'current',
        totalFiles: files.length,
        totalLOC,
        totalFunctions,
        totalClasses,
        complexity: totalComplexity,
        fileChurn: {},
      });
    } catch {
      // skip
    }

    return snapshots;
  }

  private computeTrend(
    name: string,
    snapshots: MetricSnapshot[],
    getter: (s: MetricSnapshot) => number,
  ): TrendData {
    const values = snapshots.map((s) => ({
      date: s.date,
      value: getter(s),
    }));

    let direction: TrendData['direction'] = 'stable';
    let changeRate = 0;

    if (values.length >= 2) {
      const first = values[0].value;
      const last = values[values.length - 1].value;

      if (first > 0) {
        changeRate = ((last - first) / first) * 100;
      }

      if (changeRate > 5) direction = 'increasing';
      else if (changeRate < -5) direction = 'decreasing';
      else direction = 'stable';
    }

    return { metric: name, values, direction, changeRate };
  }

  private makePredictions(trends: TrendData[]): TrendPrediction[] {
    const predictions: TrendPrediction[] = [];

    for (const trend of trends) {
      if (trend.values.length < 2) continue;

      const last = trend.values[trend.values.length - 1];
      const prev = trend.values[trend.values.length - 2];

      // Simple linear extrapolation
      const delta = last.value - prev.value;
      const months = [3, 6, 12];

      for (const m of months) {
        const predictedValue = last.value + (delta * m);
        predictions.push({
          metric: trend.metric,
          currentValue: last.value,
          predictedValue,
          monthsAhead: m,
          confidence: Math.max(0.2, 1 - (m * 0.05)), // decreases with time
          recommendation: delta > 0
            ? `Consider refactoring to manage growth in ${trend.metric.toLowerCase()}`
            : `${trend.metric} is decreasing - good trend!`,
        });
      }
    }

    return predictions;
  }

  private findHotFiles(): Array<{ file: string; churn: number; trend: string }> {
    const hotFiles: Array<{ file: string; churn: number; trend: string }> = [];

    try {
      const result = runCommandSafe(
        'git',
        ['log', '--format=', '--name-only', '--max-count=50'],
      );

      if (result.exitCode === 0) {
        const fileCounts = new Map<string, number>();
        const files = result.stdout.split('\n').filter(Boolean);

        for (const file of files) {
          fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
        }

        for (const [file, count] of fileCounts.entries()) {
          if (count > 2) {
            hotFiles.push({
              file,
              churn: count,
              trend: count > 5 ? 'frequently modified' : 'moderately active',
            });
          }
        }

        hotFiles.sort((a, b) => b.churn - a.churn);
      }
    } catch {
      // git not available
    }

    return hotFiles.slice(0, 10);
  }
}

export function printTrends(): void {
  const analyzer = new TrendAnalyzer();
  const report = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow trends]\n'));

  if (report.snapshots.length < 2) {
    console.log(chalk.yellow('Not enough git history for trend analysis.'));
    console.log();
    return;
  }

  console.log(chalk.bold('Metrics Trends:'));
  for (const trend of report.trends) {
    const dirColor = trend.direction === 'increasing' ? chalk.red
      : trend.direction === 'decreasing' ? chalk.green
        : chalk.gray;

    const arrow = trend.direction === 'increasing' ? '↑' : trend.direction === 'decreasing' ? '↓' : '→';
    console.log(`  ${dirColor(`${arrow} ${trend.metric}`)}: ${dirColor(`${trend.changeRate > 0 ? '+' : ''}${trend.changeRate.toFixed(1)}%`)}`);

    const lastValues = trend.values.slice(-3);
    for (const v of lastValues) {
      console.log(chalk.dim(`    ${v.date}: ${v.value}`));
    }
  }
  console.log();

  if (report.predictions.length > 0) {
    console.log(chalk.bold('Predictions:'));
    for (const pred of report.predictions.slice(0, 6)) {
      const predColor = pred.predictedValue > pred.currentValue * 1.2 ? chalk.red : chalk.green;
      console.log(`  ${chalk.cyan(pred.metric)}: ${pred.currentValue} → ${predColor(`${pred.predictedValue.toFixed(0)}`)} in ${pred.monthsAhead}mo (${(pred.confidence * 100).toFixed(0)}% confidence)`);
    }
    console.log();
  }

  if (report.hotFiles.length > 0) {
    console.log(chalk.bold('Hot Files (high churn):'));
    for (const f of report.hotFiles) {
      const churnColor = f.churn > 5 ? chalk.red : chalk.yellow;
      console.log(`  ${churnColor(`[${f.churn}x]`)} ${f.file} ${chalk.dim(`- ${f.trend}`)}`);
    }
  }

  console.log();
}
