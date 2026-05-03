import { Command } from 'commander';
import { TestGenerator } from '../core/test-gen';
import { Fuzzer } from '../core/fuzzer';
import { CoverageAnalyzer } from '../core/coverage';
import { EndpointTester } from '../core/test-endpoint';
import { SecurityTestGenerator } from '../core/test-security';
import { RegressionTester } from '../core/test-regression';
import { loadConfig } from '../core/config';
import { AIProviderService } from '../core/ai-provider';
import { Analyzer } from '../core/analyzer';
import { printJSON } from '../output/json';
import { writeFile } from '../utils/fs';
import chalk from 'chalk';

export function testCommand(program: Command): void {
  program
    .command('test')
    .description('Generate and run tests')
    .option('--fuzz', 'Fuzz inputs')
    .option('--ai <provider>', 'Use AI for test generation')
    .option('--endpoint <url>', 'Test a specific endpoint')
    .option('--replay', 'Replay previous traces for regression testing')
    .option('--coverage', 'Include coverage analysis')
    .option('--security', 'Security-focused checks')
    .option('--diff <refs>', 'Compare test results between refs (e.g. main..feature)')
    .option('--generate', 'Generate test stubs')
    .option('--output <path>', 'Write generated tests to file')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const generator = new TestGenerator(config);
      let result = await generator.detectAndRun();

      if (options.ai) {
        console.log(chalk.cyan('Generating AI-powered tests...'));
        const ai = new AIProviderService(config);
        const analyzer = new Analyzer(config);
        const project = analyzer.analyzeProject();
        const testCode = await ai.generateTests(project.files.map((f) => f.path).join(', '));
        if (options.output) {
          writeFile(options.output, testCode);
          console.log(chalk.green(`Tests written to ${options.output}`));
        }
        if (options.json) {
          printJSON({ aiGenerated: testCode });
          return;
        }
      }

      if (options.generate) {
        console.log(chalk.cyan('Generating test stubs...'));
        const testCode = await generator.generateTests(process.cwd());
        const code = testCode.join('\n');
        if (options.output) {
          writeFile(options.output, code);
          console.log(chalk.green(`Tests written to ${options.output}`));
        } else {
          console.log(code);
        }
        if (options.json) {
          printJSON({ generatedTests: testCode });
        }
        return;
      }

      if (options.fuzz) {
        console.log(chalk.cyan('Running fuzz tests...'));
        const fuzzer = new Fuzzer();
        const fuzzResult = await generator.fuzz(process.cwd());
        result = fuzzResult;

        if (options.json) {
          printJSON({ fuzz: fuzzResult });
          return;
        }

        console.log(chalk.bold.magenta('\n[shadow fuzz]\n'));
        console.log(`${chalk.green('✓')} ${fuzzResult.passed} inputs handled`);
        if (fuzzResult.failed > 0) {
          console.log(`${chalk.red('✗')} ${fuzzResult.failed} inputs caused errors`);
        }
        console.log('');
        return;
      }

      if (options.endpoint) {
        console.log(chalk.cyan('Testing endpoint...'));
        const endpointTester = new EndpointTester(options.endpoint);
        const healthResult = await endpointTester.healthCheck();

        if (options.json) {
          printJSON(healthResult);
          return;
        }

        console.log(chalk.bold.magenta('\n[shadow endpoint]\n'));
        if (healthResult.healthy) {
          console.log(chalk.green('✓ Endpoint is healthy'));
        } else {
          console.log(chalk.red('✗ Endpoint health check failed'));
        }
        for (const r of healthResult.results) {
          const icon = r.statusCode >= 200 && r.statusCode < 400 ? chalk.green('✓') : chalk.red('✗');
          console.log(`  ${icon} ${r.method} ${r.url} → ${r.statusCode} (${r.responseTime}ms)`);
        }

        const invalidResults = await endpointTester.testWithInvalidInputs('/');
        const errors = invalidResults.filter((r) => r.statusCode >= 500);
        if (errors.length > 0) {
          console.log(chalk.red(`\n⚠ Found ${errors.length} 500 errors with invalid inputs`));
        }

        console.log('');
        return;
      }

      if (options.security) {
        console.log(chalk.cyan('Generating security tests...'));
        const secGen = new SecurityTestGenerator();
        const tests = secGen.generateAllTests();

        if (options.json) {
          printJSON({ securityTests: tests });
          return;
        }

        console.log(chalk.bold.magenta('\n[shadow security tests]\n'));
        const categories = secGen.getCategories();
        for (const cat of categories) {
          const catTests = secGen.getTestsByCategory(cat);
          console.log(chalk.bold(`${cat} (${catTests.length} tests)`));
          for (const t of catTests) {
            console.log(`  ${chalk.cyan('•')} ${t.description}`);
          }
          console.log('');
        }
        return;
      }

      if (options.diff) {
        console.log(chalk.cyan('Comparing test results...'));
        const regTester = new RegressionTester();
        const [from, to] = options.diff.split('..');

        if (from && to) {
          const diffResult = await regTester.compareRefs(from, to);

          if (options.json) {
            printJSON(diffResult);
            return;
          }

          console.log(chalk.bold.magenta('\n[shadow test diff]\n'));
          console.log(chalk.bold(`Comparing ${from} → ${to}`));
          console.log(`  Baseline: ${diffResult.baseline.total} tests (${chalk.green(diffResult.baseline.passed)} pass, ${chalk.red(diffResult.baseline.failed)} fail)`);
          console.log(`  Current:  ${diffResult.current.total} tests (${chalk.green(diffResult.current.passed)} pass, ${chalk.red(diffResult.current.failed)} fail)`);

          if (diffResult.isRegression) {
            console.log(chalk.red(`\n⚠ Regression detected! ${diffResult.newFailures.length} new failures`));
            for (const f of diffResult.newFailures) {
              console.log(`  ${chalk.red('✗')} ${f.name}: ${f.error}`);
            }
          } else {
            console.log(chalk.green(`\n✓ No regression (${diffResult.fixedFailures.length} fixed)`));
          }

          console.log('');
        }
        return;
      }

      if (options.replay) {
        console.log(chalk.cyan('Replaying from history...'));
        const regTester = new RegressionTester();
        const history = regTester.loadHistory();

        if (options.json) {
          printJSON(history);
          return;
        }

        console.log(chalk.bold.magenta('\n[shadow replay]\n'));
        if (history.length === 0) {
          console.log(chalk.yellow('No test history found. Run tests first to build history.'));
        } else {
          const last = history[history.length - 1];
          console.log(chalk.bold(`Last run: ${last.timestamp}`));
          console.log(`  Ref: ${last.ref}`);
          console.log(`  ${chalk.green(last.results.passed)} pass, ${chalk.red(last.results.failed)} fail`);
        }
        console.log('');
        return;
      }

      if (options.coverage) {
        console.log(chalk.cyan('Analyzing coverage...'));
        const covAnalyzer = new CoverageAnalyzer();
        const covResult = await covAnalyzer.analyze();

        if (options.json) {
          printJSON(covResult);
          return;
        }

        console.log(chalk.bold.magenta('\n[shadow coverage]\n'));
        if (covResult && covResult.totalLines > 0) {
          const pct = (v: number) => `${v.toFixed(1)}%`;
          console.log(`  Lines:      ${bar(covResult.lineCoverage)} ${pct(covResult.lineCoverage)}`);
          console.log(`  Statements: ${bar(covResult.statementCoverage)} ${pct(covResult.statementCoverage)}`);
          console.log(`  Branches:   ${bar(covResult.branchCoverage)} ${pct(covResult.branchCoverage)}`);
          console.log(`  Functions:  ${bar(covResult.functionCoverage)} ${pct(covResult.functionCoverage)}`);
          console.log(`  Total lines: ${covResult.totalLines} / ${covResult.coveredLines} covered`);

          if (covResult.uncoveredAreas.length > 0) {
            console.log(chalk.yellow('\n  Uncovered areas:'));
            for (const area of covResult.uncoveredAreas.slice(0, 5)) {
              console.log(`    ${chalk.dim(area.file)}: lines [${area.lines}]`);
            }
          }
        } else {
          console.log(chalk.yellow('  No coverage data found. Run your test suite with coverage first.'));
          console.log(chalk.dim('  Tip: Use --coverage flag with jest/nyc/pytest-cov'));
        }
        console.log('');
        return;
      }

      if (options.json) {
        printJSON(result);
        return;
      }

      console.log(chalk.bold.blue('\n[shadow test]\n'));
      console.log(`${chalk.green('✓')} ${result.passed} passed`);
      console.log(`${chalk.red('✗')} ${result.failed} failed`);
      console.log(`${chalk.gray('○')} ${result.skipped} skipped`);
      console.log(`${chalk.bold('Total:')} ${result.total}`);

      if (result.coverage != null) {
        console.log(`${chalk.cyan('Coverage:')} ${result.coverage}%`);
      }

      if (result.failures.length > 0) {
        console.log(chalk.red('\nFailures:'));
        result.failures.forEach((f) =>
          console.log(`  ${chalk.red('✗')} ${f.name}: ${f.error}`),
        );
      }

      console.log('');
    });
}

function bar(pct: number): string {
  const width = 20;
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  if (pct >= 80) return chalk.green('█'.repeat(filled) + '░'.repeat(empty));
  if (pct >= 50) return chalk.yellow('█'.repeat(filled) + '░'.repeat(empty));
  return chalk.red('█'.repeat(filled) + '░'.repeat(empty));
}
