import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { DeployTarget, DeployReport, DeployCheck } from '../types';
import { getProjectRoot, fileExists } from '../utils/fs';
import { runCommandSafe } from '../utils/process';
import { printJSON } from '../output/json';
import { lintDockerfile } from '../core/deploy/docker-lint';
import { lintKubernetesManifests } from '../core/deploy/k8s-lint';
import { checkEnvironmentVariables } from '../core/deploy/env-check';
import { calculateDeployScore } from '../core/deploy/score';
import chalk from 'chalk';

export function deployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Validate a project before deployment')
    .option('--target <target>', 'Deployment target (docker|vercel|fly|k8s)')
    .option('--json', 'JSON output')
    .option('--score', 'Show deploy readiness score')
    .action(async (options) => {
      const config = loadConfig();
      const target: DeployTarget = options.target || 'docker';
      const root = getProjectRoot(process.cwd());

      console.log(chalk.bold.blue(`\n[shadow deploy --target ${target}]\n`));

      const checks = await runDeployChecks(target, root, config);
      const passed = checks.every((c) => c.status !== 'fail');

      const report: DeployReport = { target, passed, checks };

      if (options.json) {
        if (options.score) {
          const score = calculateDeployScore(
            checks.filter((c) => c.name.startsWith('Docker:') || c.name.startsWith('.dockerignore')),
            checks.filter((c) => c.name.startsWith('K8s:') || c.name.startsWith('Kind') || c.name.startsWith('Probes')),
            checks.filter((c) => c.name.includes('env') || c.name.includes('Env') || c.name.includes('Secret')),
            checks.filter((c) => c.name.includes('Build')),
            checks.filter((c) => c.name.includes('Smoke')),
            checks.filter((c) => c.name.includes('Security') || c.name.includes('Vuln')),
          );
          printJSON({ ...report, score });
        } else {
          printJSON(report);
        }
        return;
      }

      for (const check of checks) {
        const icon =
          check.status === 'pass'
            ? chalk.green('✓')
            : check.status === 'fail'
              ? chalk.red('✗')
              : chalk.yellow('⚠');
        console.log(`  ${icon} ${check.name}: ${check.message}`);
      }

      console.log('');

      if (options.score || checks.length > 0) {
        const score = calculateDeployScore(
          checks.filter((c) => c.name.startsWith('Docker:') || c.name.startsWith('.dockerignore') || c.name.includes('Non-root') || c.name.includes('Multi-stage') || c.name.includes('Healthcheck') || c.name.includes('ENTRYPOINT') || c.name.includes('Port') || c.name.includes('Layer') || c.name.includes('Prefer')),
          checks.filter((c) => c.name.startsWith('K8s:') || c.name.includes('Kind') || c.name.includes('Metadata') || c.name.includes('Resource') || c.name.includes('Probes') || c.name.includes('Replicas') || c.name.includes('Namespace') || c.name.includes('Labels')),
          checks.filter((c) => c.name.includes('env') || c.name.includes('Undocumented') || c.name.includes('Secret var') || c.name === '.env.example' || c.name === 'Environment variables'),
          checks.filter((c) => c.name.includes('Build')),
          checks.filter((c) => c.name.includes('Smoke')),
          checks.filter((c) => c.name.includes('Security') || c.name.includes('Vuln')),
        );

        console.log(chalk.bold.white(`Deploy Readiness Score: ${score.overall}/100`));
        console.log(chalk.dim(score.summary));
        console.log('');

        if (options.score) {
          console.log(chalk.bold('Category Scores:'));
          for (const [key, cat] of Object.entries(score.categories)) {
            if (cat.score >= 0) {
              const bar = renderBar(cat.score);
              console.log(`  ${cat.label.padEnd(24)} ${bar} ${cat.score}%`);
            }
          }
          console.log('');
        }

        if (score.recommendations.length > 0) {
          console.log(chalk.bold('Recommendations:'));
          for (const rec of score.recommendations) {
            if (rec.startsWith('[CRITICAL]')) {
              console.log(chalk.red(`  → ${rec.replace('[CRITICAL] ', '')}`));
            } else {
              console.log(chalk.yellow(`  → ${rec}`));
            }
          }
          console.log('');
        }
      }

      if (passed) {
        console.log(chalk.green.bold('✓ All deployment checks passed.'));
      } else {
        console.log(chalk.red.bold('✗ Some deployment checks failed.'));
      }

      console.log('');
    });
}

async function runDeployChecks(
  target: DeployTarget,
  root: string,
  config: ReturnType<typeof loadConfig>,
): Promise<DeployCheck[]> {
  const checks: DeployCheck[] = [];

  const requiredFiles: Record<DeployTarget, string[]> = {
    docker: ['Dockerfile', '.dockerignore'],
    vercel: ['vercel.json'],
    fly: ['fly.toml'],
    k8s: [],
  };

  for (const file of requiredFiles[target]) {
    checks.push({
      name: `Required file: ${file}`,
      status: fileExists(`${root}/${file}`) ? 'pass' : 'fail',
      message: fileExists(`${root}/${file}`) ? 'Found' : 'Missing',
    });
  }

  // Docker linting
  if (target === 'docker' || target === 'k8s') {
    const dockerResult = lintDockerfile(root);
    for (const check of dockerResult.checks) {
      checks.push({
        name: `Docker: ${check.name}`,
        status: check.status,
        message: check.message,
      });
    }
  }

  // Kubernetes manifest validation
  if (target === 'k8s') {
    const k8sResult = lintKubernetesManifests(root);
    for (const check of k8sResult.checks) {
      checks.push({
        name: `K8s: ${check.name}`,
        status: check.status,
        message: check.message,
      });
    }
  }

  // Environment variable checks
  const envResult = checkEnvironmentVariables(
    root,
    config.deploymentChecks?.requiredEnvVars || [],
  );
  for (const check of envResult.checks) {
    checks.push(check);
  }

  // Build command
  const buildCmd = config.deploymentChecks?.buildCommand;
  if (buildCmd) {
    const buildResult = runBuildCommand(buildCmd, root);
    checks.push(buildResult);
  } else {
    checks.push({
      name: 'Build check',
      status: 'warn',
      message: 'No build command configured — run build manually',
    });
  }

  // Smoke test
  const smokeCmd = config.deploymentChecks?.smokeTestCommand;
  if (smokeCmd) {
    const smokeResult = runSmokeTest(smokeCmd, root);
    checks.push(smokeResult);
  } else {
    checks.push({
      name: 'Smoke test',
      status: 'warn',
      message: 'No smoke test command configured',
    });
  }

  // Dependency vulnerability scan
  const vulnResult = await runVulnerabilityScan(root);
  checks.push(vulnResult);

  // Required env vars
  for (const envVar of config.deploymentChecks?.requiredEnvVars || []) {
    checks.push({
      name: `Environment: ${envVar}`,
      status: process.env[envVar] ? 'pass' : 'warn',
      message: process.env[envVar] ? 'Set' : 'Not set (may be needed)',
    });
  }

  return checks;
}

function runBuildCommand(cmd: string, root: string): DeployCheck {
  const [bin, ...args] = cmd.split(/\s+/);
  const result = runCommandSafe(bin, args, root);

  if (result.exitCode === 0) {
    return {
      name: 'Build command',
      status: 'pass',
      message: `"${cmd}" completed successfully`,
    };
  }
  return {
    name: 'Build command',
    status: 'fail',
    message: `"${cmd}" failed: ${result.stderr.slice(0, 120)}`,
  };
}

function runSmokeTest(cmd: string, root: string): DeployCheck {
  const [bin, ...args] = cmd.split(/\s+/);
  const result = runCommandSafe(bin, args, root);

  if (result.exitCode === 0) {
    return {
      name: 'Smoke test',
      status: 'pass',
      message: `"${cmd}" passed`,
    };
  }
  return {
    name: 'Smoke test',
    status: 'fail',
    message: `"${cmd}" failed: ${result.stderr.slice(0, 120)}`,
  };
}

async function runVulnerabilityScan(root: string): Promise<DeployCheck> {
  if (!fileExists(`${root}/package-lock.json`) && !fileExists(`${root}/yarn.lock`)) {
    return {
      name: 'Vulnerability scan',
      status: 'warn',
      message: 'No lockfile found — cannot run vulnerability audit',
    };
  }

  try {
    const result = runCommandSafe('npm', ['audit', '--json'], root);
    if (result.exitCode === 0) {
      return {
        name: 'Vulnerability scan',
        status: 'pass',
        message: 'No known vulnerabilities found',
      };
    }

    try {
      const auditData = JSON.parse(result.stdout);
      const vulnCount =
        auditData.metadata?.vulnerabilities?.total ?? auditData.vulnerabilities
          ? Object.keys(auditData.vulnerabilities || {}).length
          : 0;

      if (vulnCount > 0) {
        return {
          name: 'Vulnerability scan',
          status: 'fail',
          message: `${vulnCount} known vulnerabilit${vulnCount === 1 ? 'y' : 'ies'} found`,
        };
      }
    } catch {
      // JSON parse error, fall through
    }

    return {
      name: 'Vulnerability scan',
      status: 'warn',
      message: 'Could not complete vulnerability audit',
    };
  } catch {
    return {
      name: 'Vulnerability scan',
      status: 'warn',
      message: 'npm audit not available',
    };
  }
}

function renderBar(score: number): string {
  const width = 10;
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  if (score >= 75) return chalk.green('█'.repeat(filled) + '░'.repeat(empty));
  if (score >= 50) return chalk.yellow('█'.repeat(filled) + '░'.repeat(empty));
  return chalk.red('█'.repeat(filled) + '░'.repeat(empty));
}
