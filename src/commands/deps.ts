import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, fileExists, findFiles } from '../utils/fs';
import { runCommandSafe } from '../utils/process';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as path from 'path';

export function depsCommand(program: Command): void {
  program
    .command('deps')
    .description('Dependency analysis and auditing')
    .option('--outdated', 'Check for outdated packages')
    .option('--license', 'Show package licenses')
    .option('--tree', 'Dependency tree')
    .option('--vulnerabilities', 'Check for known vulnerabilities')
    .option('--json', 'JSON output')
    .option('--depth <n>', 'Tree depth', '3')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const root = process.cwd();

      const deps = {
        totalImports: 0,
        externalCount: 0,
        internalCount: 0,
        externalPackages: new Set<string>(),
        internalRefs: new Set<string>(),
        filesByImport: new Map<string, string[]>(),
      };

      for (const file of project.files) {
        for (const imp of file.imports) {
          deps.totalImports++;
          if (imp.type === 'external') {
            deps.externalCount++;
            deps.externalPackages.add(imp.name);
            const files = deps.filesByImport.get(imp.name) || [];
            files.push(file.path);
            deps.filesByImport.set(imp.name, files);
          } else {
            deps.internalCount++;
            deps.internalRefs.add(imp.name);
          }
        }
      }

      if (options.tree) {
        const depth = parseInt(options.depth, 10);
        const tree = await getDependencyTree(root, depth);

        if (options.json) {
          printJSON(tree);
          return;
        }

        console.log(chalk.bold.blue('\n[shadow deps --tree]\n'));
        printTree(tree, '', true);
        console.log('');
        return;
      }

      if (options.outdated) {
        const outdated = await checkOutdated(root);

        if (options.json) {
          printJSON(outdated);
          return;
        }

        console.log(chalk.bold.blue('\n[shadow deps --outdated]\n'));
        if (outdated.length === 0) {
          console.log(chalk.green('All dependencies are up to date.'));
        } else {
          for (const pkg of outdated) {
            console.log(`  ${chalk.yellow('⚠')} ${pkg.name}: ${pkg.current} → ${chalk.green(pkg.latest)}`);
          }
        }
        console.log('');
        return;
      }

      if (options.license) {
        console.log(chalk.bold.blue('\n[shadow deps --license]\n'));
        try {
          const result = runCommandSafe('npx', ['license-checker', '--json']);
          const licenses = JSON.parse(result.stdout || '{}');
          const byLicense: Record<string, string[]> = {};
          for (const [pkg, info] of Object.entries(licenses) as Array<[string, { licenses: string }]>) {
            const lic = info.licenses || 'Unknown';
            if (!byLicense[lic]) byLicense[lic] = [];
            byLicense[lic].push(pkg);
          }
          for (const [lic, pkgs] of Object.entries(byLicense)) {
            console.log(`  ${chalk.cyan(lic)}: ${pkgs.length} packages`);
          }
        } catch {
          console.log(chalk.yellow('Could not determine licenses. Install license-checker or check package.json.'));
        }
        console.log('');
        return;
      }

      if (options.vulnerabilities) {
        console.log(chalk.bold.blue('\n[shadow deps --vulnerabilities]\n'));
        try {
          const result = runCommandSafe('npm', ['audit', '--json']);
          const audit = JSON.parse(result.stdout || '{}');
          const vulns = audit.vulnerabilities || {};
          const keys = Object.keys(vulns);
          if (keys.length === 0) {
            console.log(chalk.green('No known vulnerabilities found.'));
          } else {
            const bySeverity: Record<string, number> = {};
            for (const [, v] of Object.entries(vulns) as Array<[string, { severity: string }]>) {
              bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
            }
            for (const [sev, count] of Object.entries(bySeverity)) {
              const color = sev === 'critical' ? chalk.red : sev === 'high' ? chalk.red : sev === 'moderate' ? chalk.yellow : chalk.gray;
              console.log(`  ${color(`${sev}: ${count}`)}`);
            }
          }
        } catch {
          console.log(chalk.red('Could not run npm audit. Make sure npm is installed.'));
        }
        console.log('');
        return;
      }

      if (options.json) {
        printJSON({
          totalImports: deps.totalImports,
          external: { count: deps.externalCount, packages: Array.from(deps.externalPackages) },
          internal: { count: deps.internalCount, refs: Array.from(deps.internalRefs) },
        });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow deps]\n'));
      console.log(chalk.bold(`Total imports: ${deps.totalImports}`));
      console.log(`  External: ${deps.externalCount} (${deps.externalPackages.size} unique)`);
      console.log(`  Internal: ${deps.internalCount}`);

      if (deps.externalPackages.size > 0) {
        console.log(chalk.bold('\nExternal dependencies:'));
        const sorted = Array.from(deps.externalPackages).sort();
        for (const pkg of sorted) {
          const files = deps.filesByImport.get(pkg) || [];
          console.log(`  ${chalk.cyan('↳')} ${pkg} ${chalk.dim(`(${files.length} files)`)}`);
        }
      }
      console.log('');
    });
}

async function getDependencyTree(root: string, depth: number): Promise<Record<string, unknown>> {
  try {
    const result = runCommandSafe('npm', ['ls', '--depth', String(depth), '--json'], root);
    return JSON.parse(result.stdout || '{}');
  } catch {
    return { error: 'Could not parse dependency tree' };
  }
}

function printTree(node: Record<string, unknown>, prefix: string, isLast: boolean): void {
  const deps = node.dependencies as Record<string, { version: string; dependencies?: Record<string, unknown> }> | undefined;
  if (!deps) return;

  const keys = Object.keys(deps);
  keys.forEach((key, i) => {
    const isLastDep = i === keys.length - 1;
    const connector = isLastDep ? '└──' : '├──';
    const version = deps[key].version || '';
    console.log(`  ${prefix}${connector} ${chalk.cyan(key)} ${chalk.dim(version)}`);
    if (deps[key].dependencies) {
      printTree({ dependencies: deps[key].dependencies }, prefix + (isLastDep ? '    ' : '│   '), isLastDep);
    }
  });
}

async function checkOutdated(root: string): Promise<Array<{ name: string; current: string; latest: string }>> {
  try {
    const result = runCommandSafe('npm', ['outdated', '--json'], root);
    if (!result.stdout) return [];
    const data = JSON.parse(result.stdout);
    return Object.entries(data).map(([name, info]) => ({
      name,
      current: (info as Record<string, string>).current || 'unknown',
      latest: (info as Record<string, string>).latest || 'unknown',
    }));
  } catch {
    return [];
  }
}
