import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface DebtScore {
  file: string;
  totalScore: number;
  complexityScore: number;
  duplicationScore: number;
  coverageScore: number;
  churnScore: number;
  smellsCount: number;
  rating: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface DebtTrend {
  date: string;
  totalDebt: number;
  filesAnalyzed: number;
  averageDebt: number;
}

export interface RefactoringSuggestion {
  file: string;
  issue: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: 'small' | 'medium' | 'large';
  suggestion: string;
}

export interface TechDebtReport {
  scores: DebtScore[];
  overallRating: string;
  totalDebt: number;
  worstFiles: DebtScore[];
  byModule: Record<string, number>;
  suggestions: RefactoringSuggestion[];
  trend: DebtTrend[];
}

export class TechDebtEstimator {
  estimate(projectPath?: string): TechDebtReport {
    const root = projectPath || process.cwd();
    const files = findFiles(root, [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const scores: DebtScore[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        const score = this.scoreFile(content, file);
        scores.push(score);
      } catch {
        // skip
      }
    }

    scores.sort((a, b) => b.totalScore - a.totalScore);

    const totalDebt = scores.reduce((sum, s) => sum + s.totalScore, 0);
    const avgDebt = scores.length > 0 ? totalDebt / scores.length : 0;
    const overallRating = avgDebt < 20 ? 'A' : avgDebt < 40 ? 'B' : avgDebt < 60 ? 'C' : avgDebt < 80 ? 'D' : 'F';

    const byModule: Record<string, number> = {};
    for (const score of scores) {
      const module = score.file.split('/')[0] || 'root';
      byModule[module] = (byModule[module] || 0) + score.totalScore;
    }

    const suggestions = this.generateSuggestions(scores);

    return {
      scores,
      overallRating,
      totalDebt,
      worstFiles: scores.slice(0, 10),
      byModule,
      suggestions,
      trend: [],
    };
  }

  private scoreFile(content: string, file: string): DebtScore {
    const lines = content.split('\n');
    const loc = lines.length;

    // 1. Complexity score (0-100)
    let complexityScore = 0;
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch', '&&', '||', '?'];
    let complexityHits = 0;
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) complexityHits += matches.length;
    }
    complexityScore = Math.min(100, (complexityHits / Math.max(1, loc)) * 100);

    // 2. Duplication score (0-100) - simplified heuristic
    let duplicationScore = 0;
    const lineSet = new Set<string>();
    let duplicateLines = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.length > 10) {
        if (lineSet.has(trimmed)) duplicateLines++;
        else lineSet.add(trimmed);
      }
    }
    duplicationScore = Math.min(100, (duplicateLines / Math.max(1, loc)) * 200);

    // 3. Coverage/gaps score - based on lack of tests
    let coverageScore = 0;
    const hasTestFile = file.includes('test') || file.includes('spec') || file.includes('.test.') || file.includes('.spec.');
    const hasRelatedTest = false; // simplified
    coverageScore = hasTestFile ? 0 : 20;

    // 4. Churn score - would need git history, simplified
    const churnScore = 10;

    // 5. File size penalty
    const sizePenalty = loc > 500 ? 30 : loc > 200 ? 15 : loc > 100 ? 5 : 0;

    const totalScore = complexityScore + duplicationScore + coverageScore + churnScore + sizePenalty;

    let rating: DebtScore['rating'];
    if (totalScore < 20) rating = 'A';
    else if (totalScore < 40) rating = 'B';
    else if (totalScore < 60) rating = 'C';
    else if (totalScore < 80) rating = 'D';
    else rating = 'F';

    return {
      file,
      totalScore: Math.min(100, totalScore),
      complexityScore,
      duplicationScore,
      coverageScore,
      churnScore,
      smellsCount: 0,
      rating,
    };
  }

  private generateSuggestions(scores: DebtScore[]): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    for (const score of scores) {
      if (score.complexityScore > 40) {
        suggestions.push({
          file: score.file,
          issue: 'High cyclomatic complexity',
          priority: score.complexityScore > 60 ? 'high' : 'medium',
          estimatedEffort: score.complexityScore > 60 ? 'large' : 'medium',
          suggestion: 'Break down complex functions into smaller, focused ones. Extract conditional logic into separate functions.',
        });
      }

      if (score.totalScore > 70) {
        suggestions.push({
          file: score.file,
          issue: 'Overall high technical debt',
          priority: 'high',
          estimatedEffort: 'large',
          suggestion: 'Consider a targeted refactoring sprint for this file. Add tests, reduce complexity, eliminate duplication.',
        });
      }
    }

    return suggestions.sort((a, b) => {
      const p = { high: 3, medium: 2, low: 1 };
      return (p[b.priority] || 0) - (p[a.priority] || 0);
    }).slice(0, 20);
  }

  trackDebtOverTime(projectPath?: string): DebtTrend[] {
    const trend: DebtTrend[] = [];
    // Simplified trend - in a real implementation this would use git history
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      trend.push({
        date: date.toISOString().slice(0, 7),
        totalDebt: 0,
        filesAnalyzed: 0,
        averageDebt: 0,
      });
    }

    return trend;
  }
}

export function printTechDebt(): void {
  const estimator = new TechDebtEstimator();
  const report = estimator.estimate();

  console.log(chalk.bold.blue('\n[shadow debt]\n'));

  console.log(chalk.bold('Technical Debt Report:'));
  const ratingColor = report.overallRating === 'A' ? chalk.green
    : report.overallRating === 'B' ? chalk.cyan
      : report.overallRating === 'C' ? chalk.yellow
        : report.overallRating === 'D' ? chalk.red
          : chalk.red.bold;

  console.log(`  Overall Rating: ${ratingColor(report.overallRating)}`);
  console.log(`  Total Files:    ${report.scores.length}`);
  console.log(`  Total Debt:     ${report.totalDebt.toFixed(0)}`);

  const ratingDist: Record<string, number> = {};
  for (const s of report.scores) {
    ratingDist[s.rating] = (ratingDist[s.rating] || 0) + 1;
  }
  console.log(`  Distribution:   ${Object.entries(ratingDist).map(([r, c]) => `${r}:${c}`).join(' ')}`);
  console.log();

  if (report.worstFiles.length > 0) {
    console.log(chalk.bold('Worst Files by Technical Debt:'));
    for (const s of report.worstFiles.slice(0, 10)) {
      const color = s.rating === 'F' ? chalk.red : s.rating === 'D' ? chalk.yellow : chalk.gray;
      console.log(`  ${color(`[${s.rating}]`)} ${chalk.white(s.file)} ${chalk.dim(`(score: ${s.totalScore.toFixed(0)})`)}`);
      console.log(chalk.dim(`    complexity: ${s.complexityScore.toFixed(0)} | duplication: ${s.duplicationScore.toFixed(0)} | coverage: ${s.coverageScore.toFixed(0)}`));
    }
    console.log();
  }

  if (report.suggestions.length > 0) {
    console.log(chalk.bold('Top Refactoring Suggestions:'));
    for (const sug of report.suggestions.slice(0, 5)) {
      const prio = sug.priority === 'high' ? chalk.red : sug.priority === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`  ${prio(`[${sug.priority}]`)} ${sug.file}`);
      console.log(chalk.dim(`    ${sug.issue}`));
      console.log(chalk.dim(`    ${sug.suggestion}`));
    }
    console.log();
  }

  if (Object.keys(report.byModule).length > 0) {
    console.log(chalk.bold('Debt by Module:'));
    const sorted = Object.entries(report.byModule).sort((a, b) => b[1] - a[1]);
    for (const [mod, debt] of sorted.slice(0, 10)) {
      console.log(`  ${chalk.cyan(mod)}: ${debt.toFixed(0)}`);
    }
  }
  console.log();
}
