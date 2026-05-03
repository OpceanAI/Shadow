import { TestResult, TestFailure } from '../types';
import { GitService } from './git';
import { runCommandSafe } from '../utils/process';
import { writeFile, readFile, fileExists } from '../utils/fs';
import * as path from 'path';

export interface RegressionResult {
  baseline: TestResult;
  current: TestResult;
  newFailures: TestFailure[];
  fixedFailures: TestFailure[];
  isRegression: boolean;
  summary: string;
}

export interface TestHistory {
  timestamp: string;
  ref: string;
  results: TestResult;
}

export class RegressionTester {
  private git: GitService;
  private historyPath: string;

  constructor(rootPath?: string) {
    this.git = new GitService(rootPath);
    this.historyPath = path.join(process.cwd(), '.shadow', 'test-history.json');
  }

  async compareRefs(from: string, to: string): Promise<RegressionResult> {
    const basePath = '/tmp/shadow-regression';
    const repoPath = await this.getRepoPath();

    const results = await this.runBothRefs(repoPath, from, to);

    const newFailures = results.current.failures.filter(
      (f) => !results.baseline.failures.some(
        (b) => b.name === f.name && b.file === f.file,
      ),
    );

    const fixedFailures = results.baseline.failures.filter(
      (f) => !results.current.failures.some(
        (b) => b.name === f.name && b.file === f.file,
      ),
    );

    const isRegression = results.current.failed > results.baseline.failed;

    return {
      baseline: results.baseline,
      current: results.current,
      newFailures,
      fixedFailures,
      isRegression,
      summary: this.buildSummary(results.baseline, results.current, newFailures, fixedFailures),
    };
  }

  async saveResults(results: TestResult, ref?: string): Promise<void> {
    const history = this.loadHistory();
    history.push({
      timestamp: new Date().toISOString(),
      ref: ref || 'HEAD',
      results,
    });

    const dir = path.dirname(this.historyPath);
    writeFile(this.historyPath, JSON.stringify(history, null, 2));
  }

  loadHistory(): TestHistory[] {
    if (!fileExists(this.historyPath)) return [];
    try {
      return JSON.parse(readFile(this.historyPath)) as TestHistory[];
    } catch {
      return [];
    }
  }

  detectRegression(current: TestResult): RegressionResult | null {
    const history = this.loadHistory();
    if (history.length === 0) return null;

    const baseline = history[history.length - 1].results;
    const newFailures = current.failures.filter(
      (f) => !baseline.failures.some((b) => b.name === f.name),
    );

    return {
      baseline,
      current,
      newFailures,
      fixedFailures: [],
      isRegression: current.failed > baseline.failed,
      summary: `Compared to ${history[history.length - 1].ref}: ${newFailures.length} new failures`,
    };
  }

  getTrend(): { timestamp: string; total: number; passed: number; failed: number }[] {
    return this.loadHistory().map((h) => ({
      timestamp: h.timestamp,
      total: h.results.total,
      passed: h.results.passed,
      failed: h.results.failed,
    }));
  }

  private async runBothRefs(
    repoPath: string,
    from: string,
    to: string,
  ): Promise<{ baseline: TestResult; current: TestResult }> {
    let baseline: TestResult = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
    let current: TestResult = { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };

    try {
      const tmpDir = `/tmp/shadow-regression-${Date.now()}`;
      runCommandSafe('git', ['clone', repoPath, tmpDir]);
      runCommandSafe('git', ['checkout', from], tmpDir);
      baseline = this.detectAndRunIn(tmpDir);

      runCommandSafe('git', ['checkout', to], tmpDir);
      current = this.detectAndRunIn(tmpDir);

      runCommandSafe('rm', ['-rf', tmpDir]);
    } catch {
      // Git operations may fail, return empty
    }

    return { baseline, current };
  }

  private detectAndRunIn(dir: string): TestResult {
    try {
      if (fileExists(`${dir}/package.json`)) {
        if (fileExists(`${dir}/node_modules/.bin/jest`)) {
          return this.parseTestOutput(runCommandSafe('npx', ['jest', '--json', '--no-coverage'], dir));
        }
        if (fileExists(`${dir}/node_modules/.bin/vitest`)) {
          return this.parseTestOutput(runCommandSafe('npx', ['vitest', 'run', '--reporter=json'], dir));
        }
      }
      if (fileExists(`${dir}/pyproject.toml`) || fileExists(`${dir}/setup.py`)) {
        return this.parsePyTestOutput(runCommandSafe('python', ['-m', 'pytest', '--json-report', '-q'], dir));
      }
      if (fileExists(`${dir}/go.mod`)) {
        return this.parseGoTestOutput(runCommandSafe('go', ['test', '-json', './...'], dir));
      }
      if (fileExists(`${dir}/Cargo.toml`)) {
        return this.parseRustTestOutput(runCommandSafe('cargo', ['test'], dir));
      }
    } catch {
      // silent
    }
    return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  }

  private parseTestOutput(result: { stdout: string; stderr: string; exitCode: number }): TestResult {
    try {
      const json = JSON.parse(result.stdout);
      return {
        total: json.numTotalTests || json.total || 0,
        passed: json.numPassedTests || json.passed || 0,
        failed: json.numFailedTests || json.failed || 0,
        skipped: json.numPendingTests || json.skipped || 0,
        failures: [],
      };
    } catch {
      return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
    }
  }

  private parsePyTestOutput(result: { stdout: string; stderr: string; exitCode: number }): TestResult {
    const output = result.stdout;
    const passed = (output.match(/PASSED/g) || []).length;
    const failed = (output.match(/FAILED/g) || []).length;
    return { total: passed + failed, passed, failed, skipped: 0, failures: [] };
  }

  private parseGoTestOutput(result: { stdout: string; stderr: string; exitCode: number }): TestResult {
    const output = result.stdout;
    const passed = (output.match(/"Action":"pass"/g) || []).length;
    const failed = (output.match(/"Action":"fail"/g) || []).length;
    return { total: passed + failed, passed, failed, skipped: 0, failures: [] };
  }

  private parseRustTestOutput(result: { stdout: string; stderr: string; exitCode: number }): TestResult {
    const output = result.stdout;
    const passed = (output.match(/\.\.\. ok/g) || []).length;
    const failed = (output.match(/\.\.\. FAILED/g) || []).length;
    return { total: passed + failed, passed, failed, skipped: 0, failures: [] };
  }

  private async getRepoPath(): Promise<string> {
    return process.cwd();
  }

  private buildSummary(
    baseline: TestResult,
    current: TestResult,
    newFailures: TestFailure[],
    fixedFailures: TestFailure[],
  ): string {
    const parts: string[] = [];

    if (current.total !== baseline.total) {
      parts.push(`Tests changed: ${baseline.total} → ${current.total}`);
    }
    if (newFailures.length > 0) {
      parts.push(`${newFailures.length} new failure(s)`);
    }
    if (fixedFailures.length > 0) {
      parts.push(`${fixedFailures.length} fixed failure(s)`);
    }
    if (parts.length === 0) {
      parts.push('No change in test results');
    }

    return parts.join('. ');
  }
}
