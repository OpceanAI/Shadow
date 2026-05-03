import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface RefactoringStep {
  id: number;
  title: string;
  description: string;
  file?: string;
  files: string[];
  risk: 'low' | 'medium' | 'high';
  estimatedEffort: 'small' | 'medium' | 'large';
  estimatedHours: number;
  dependencies: number[];
  category: string;
  successCriteria: string;
}

export interface RefactoringPlan {
  steps: RefactoringStep[];
  totalEffort: {
    hours: number;
    days: number;
    steps: number;
  };
  riskSummary: {
    high: number;
    medium: number;
    low: number;
  };
  byCategory: Record<string, number>;
  executionOrder: number[];
}

export class RefactoringPlanner {
  generatePlan(projectPath?: string): RefactoringPlan {
    const root = projectPath || process.cwd();
    const files = findFiles(root, [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const steps: RefactoringStep[] = [];
    const analyzedFiles: Array<{ path: string; content: string; lines: number; functions: number; complexity: number }> = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        const lines = content.split('\n').length;
        const functions = this.countFunctions(content);

        const complexityHits = content.match(/\b(?:if|else|for|while|switch|case|catch)\b/g);
        const complexity = complexityHits ? complexityHits.length : 0;

        analyzedFiles.push({ path: file, content, lines, functions, complexity });
      } catch {
        // skip
      }
    }

    let stepId = 0;

    // 1. Low-hanging fruit: large files with clear splits
    const largeFiles = analyzedFiles.filter((f) => f.lines > 400).sort((a, b) => b.lines - a.lines);
    for (const file of largeFiles.slice(0, 3)) {
      stepId++;
      steps.push({
        id: stepId,
        title: `Split large file: ${file.path}`,
        description: `File has ${file.lines} lines with ${file.functions} functions. Split into focused modules.`,
        file: file.path,
        files: [file.path],
        risk: 'medium',
        estimatedEffort: 'large',
        estimatedHours: Math.ceil(file.lines / 100),
        dependencies: [],
        category: 'file-organization',
        successCriteria: `File reduced to under 200 lines while maintaining test coverage`,
      });
    }

    // 2. Extract duplicate code
    const duplicates = this.findDuplicates(analyzedFiles);
    if (duplicates.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Extract shared utility functions',
        description: `Found ${duplicates.length} files with potential duplicate code blocks. Create shared utilities.`,
        files: duplicates,
        risk: 'medium',
        estimatedEffort: 'medium',
        estimatedHours: duplicates.length * 0.5,
        dependencies: [],
        category: 'duplication',
        successCriteria: 'Duplicate code reduced by 50% or more',
      });
    }

    // 3. Add TypeScript types for untyped JS files
    const jsFiles = analyzedFiles.filter((f) => f.path.endsWith('.js') || f.path.endsWith('.jsx'));
    if (jsFiles.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Add TypeScript type declarations',
        description: `${jsFiles.length} JavaScript files could benefit from TypeScript typing.`,
        files: jsFiles.map((f) => f.path).slice(0, 5),
        risk: 'low',
        estimatedEffort: 'medium',
        estimatedHours: jsFiles.length * 0.5,
        dependencies: [],
        category: 'type-safety',
        successCriteria: 'TypeScript strict mode passes without errors',
      });
    }

    // 4. Reduce high complexity files
    const complexFiles = analyzedFiles
      .map((f) => ({ ...f, ratio: f.lines > 0 ? f.complexity / f.lines : 0 }))
      .filter((f) => f.ratio > 0.2)
      .sort((a, b) => b.ratio - a.ratio);

    if (complexFiles.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Reduce cyclomatic complexity',
        description: `${complexFiles.length} files have high complexity-to-LOC ratio. Simplify conditional logic.`,
        files: complexFiles.slice(0, 5).map((f) => f.path),
        risk: 'medium',
        estimatedEffort: 'medium',
        estimatedHours: complexFiles.length * 1,
        dependencies: [],
        category: 'complexity',
        successCriteria: 'Cyclomatic complexity reduced below 10 per function',
      });
    }

    // 5. Add missing tests
    const testableFiles = analyzedFiles.filter((f) => f.functions > 2 && !f.path.includes('test') && !f.path.includes('.test.'));
    const untestedFiles = testableFiles
      .filter((f) => !analyzedFiles.some((af) => af.path.includes(f.path.replace(/\.[^.]+$/, '')) && af.path.includes('test')))
      .slice(0, 5);

    if (untestedFiles.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Add unit tests for untested modules',
        description: `${untestedFiles.length} files have no corresponding test files.`,
        files: untestedFiles.map((f) => f.path),
        risk: 'low',
        estimatedEffort: 'large',
        estimatedHours: untestedFiles.length * 2,
        dependencies: [],
        category: 'testing',
        successCriteria: 'Test coverage above 80% for affected files',
      });
    }

    // 6. Standardize naming conventions
    stepId++;
    steps.push({
      id: stepId,
      title: 'Standardize naming conventions',
      description: 'Ensure consistent naming across the codebase (camelCase for variables, PascalCase for classes, etc.)',
      files: analyzedFiles.map((f) => f.path).slice(0, 20),
      risk: 'low',
      estimatedEffort: 'small',
      estimatedHours: 2,
      dependencies: [],
      category: 'code-style',
      successCriteria: 'All files follow project naming conventions',
    });

    // 7. Remove deprecated/unused code
    const deprecatedFiles = analyzedFiles.filter((f) =>
      f.content.includes('@deprecated') ||
      f.content.includes('DEPRECATED') ||
      f.content.includes('TODO: remove') ||
      f.content.includes('FIXME: remove'),
    );

    if (deprecatedFiles.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Remove deprecated code',
        description: `${deprecatedFiles.length} files contain deprecated or marked-for-removal code.`,
        files: deprecatedFiles.map((f) => f.path),
        risk: 'medium',
        estimatedEffort: 'small',
        estimatedHours: deprecatedFiles.length * 0.5,
        dependencies: [],
        category: 'cleanup',
        successCriteria: 'No @deprecated annotations remaining',
      });
    }

    // 8. Improve error handling
    const poorErrorHandling = analyzedFiles.filter((f) => {
      const hasRiskyOps = f.content.includes('fetch(') || f.content.includes('JSON.parse') || f.content.includes('fs.');
      const hasTryCatch = f.content.includes('try {');
      return hasRiskyOps && !hasTryCatch;
    });

    if (poorErrorHandling.length > 0) {
      stepId++;
      steps.push({
        id: stepId,
        title: 'Improve error handling',
        description: `${poorErrorHandling.length} files have risky operations without try-catch blocks.`,
        files: poorErrorHandling.slice(0, 5).map((f) => f.path),
        risk: 'low',
        estimatedEffort: 'medium',
        estimatedHours: poorErrorHandling.length * 0.5,
        dependencies: [],
        category: 'reliability',
        successCriteria: 'All risky operations wrapped in error handlers',
      });
    }

    return this.finalizePlan(steps);
  }

  private countFunctions(content: string): number {
    const patterns = [
      /function\s+\w+/g,
      /\w+\s*=\s*(?:async\s*)?\(/g,
      /=>\s*\{/g,
      /def\s+\w+/g,
      /func\s+\w+/g,
    ];

    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  private findDuplicates(files: Array<{ path: string; content: string }>): string[] {
    const duplicates: string[] = [];
    const signatures = new Map<string, string>();

    for (const file of files) {
      const sig = this.computeSignature(file.content);
      if (signatures.has(sig)) {
        if (!duplicates.includes(file.path)) duplicates.push(file.path);
        const other = signatures.get(sig)!;
        if (!duplicates.includes(other)) duplicates.push(other);
      } else {
        signatures.set(sig, file.path);
      }
    }

    return duplicates.slice(0, 10);
  }

  private computeSignature(content: string): string {
    const lines = content.split('\n');
    const sig = lines
      .filter((l) => l.trim().length > 10)
      .slice(0, 20)
      .map((l) => l.trim().slice(0, 40))
      .join('|');
    return sig.slice(0, 500);
  }

  private finalizePlan(steps: RefactoringStep[]): RefactoringPlan {
    const totalHours = steps.reduce((s, step) => s + step.estimatedHours, 0);
    const riskSummary = {
      high: steps.filter((s) => s.risk === 'high').length,
      medium: steps.filter((s) => s.risk === 'medium').length,
      low: steps.filter((s) => s.risk === 'low').length,
    };

    const byCategory: Record<string, number> = {};
    for (const step of steps) {
      byCategory[step.category] = (byCategory[step.category] || 0) + 1;
    }

    const executionOrder: number[] = [];
    const completed = new Set<number>();
    const stepMap = new Map<number, RefactoringStep>();
    for (const s of steps) stepMap.set(s.id, s);

    while (completed.size < steps.length) {
      for (const step of steps) {
        if (completed.has(step.id)) continue;
        const depsSatisfied = step.dependencies.every((d) => completed.has(d));
        if (depsSatisfied) {
          executionOrder.push(step.id);
          completed.add(step.id);
        }
      }
    }

    return {
      steps,
      totalEffort: {
        hours: totalHours,
        days: Math.ceil(totalHours / 6),
        steps: steps.length,
      },
      riskSummary,
      byCategory,
      executionOrder,
    };
  }
}

export function printRefactorPlan(): void {
  const planner = new RefactoringPlanner();
  const plan = planner.generatePlan();

  console.log(chalk.bold.blue('\n[shadow refactorplan]\n'));

  console.log(chalk.bold('Refactoring Plan:'));
  console.log(`  Total steps:    ${plan.totalEffort.steps}`);
  console.log(`  Est. hours:     ${plan.totalEffort.hours}`);
  console.log(`  Est. days:      ${plan.totalEffort.days}`);
  console.log();

  console.log(chalk.bold('Risk Summary:'));
  console.log(`  ${chalk.red(`High: ${plan.riskSummary.high}`)}`);
  console.log(`  ${chalk.yellow(`Medium: ${plan.riskSummary.medium}`)}`);
  console.log(`  ${chalk.gray(`Low: ${plan.riskSummary.low}`)}`);
  console.log();

  if (Object.keys(plan.byCategory).length > 0) {
    console.log(chalk.bold('By Category:'));
    for (const [cat, count] of Object.entries(plan.byCategory)) {
      console.log(`  ${chalk.cyan(cat)}: ${count} steps`);
    }
    console.log();
  }

  console.log(chalk.bold('Execution Plan:'));
  for (const stepId of plan.executionOrder) {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) continue;

    const riskColor = step.risk === 'high' ? chalk.red : step.risk === 'medium' ? chalk.yellow : chalk.green;
    const effortColor = step.estimatedEffort === 'large' ? chalk.red : step.estimatedEffort === 'medium' ? chalk.yellow : chalk.gray;

    console.log(`  ${chalk.bold.white(`Step ${step.id}`)}`);
    console.log(`    ${chalk.white(step.title)}`);
    console.log(`    Risk: ${riskColor(step.risk)} | Effort: ${effortColor(step.estimatedEffort)} | Hours: ${step.estimatedHours}`);
    console.log(chalk.dim(`    ${step.description}`));

    if (step.files.length > 0) {
      for (const f of step.files.slice(0, 3)) {
        console.log(chalk.dim(`    - ${f}`));
      }
      if (step.files.length > 3) {
        console.log(chalk.dim(`    ... and ${step.files.length - 3} more files`));
      }
    }
    console.log();
  }
}
