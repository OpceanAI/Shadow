import * as fs from 'fs';
import { readFile, findFiles, fileExists } from '../utils/fs';
import chalk from 'chalk';
import * as path from 'path';

export interface WorkspacePackage {
  name: string;
  path: string;
  version: string;
  dependencies: string[];
  devDependencies: string[];
  peerDependencies: string[];
  scripts: Record<string, string>;
  language: string;
}

export interface PackageDependency {
  from: string;
  to: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | 'workspace';
  version: string;
}

export interface ImpactAnalysis {
  changedFiles: string[];
  affectedPackages: string[];
  affectedDependents: string[];
  risk: 'low' | 'medium' | 'high';
  summary: string;
}

export interface MonorepoAnalysis {
  packages: WorkspacePackage[];
  dependencies: PackageDependency[];
  rootConfig: Record<string, unknown>;
  tool: 'npm' | 'yarn' | 'pnpm' | 'nx' | 'turborepo' | 'lerna' | 'rush' | 'bazel' | 'none';
}

export class MonorepoAnalyzer {
  analyze(projectPath?: string): MonorepoAnalysis {
    const root = projectPath || process.cwd();

    const tool = this.detectTool(root);
    const packages = this.findPackages(root, tool);
    const dependencies = this.resolveDependencies(packages);
    const rootConfig = this.readRootConfig(root, tool);

    return {
      packages,
      dependencies,
      rootConfig,
      tool,
    };
  }

  private detectTool(root: string): MonorepoAnalysis['tool'] {
    try {
      if (fileExists(path.join(root, 'pnpm-workspace.yaml'))) return 'pnpm';
      if (fileExists(path.join(root, 'rush.json'))) return 'rush';
      if (fileExists(path.join(root, 'lerna.json'))) return 'lerna';
      if (fileExists(path.join(root, 'nx.json'))) return 'nx';
      if (fileExists(path.join(root, 'turbo.json'))) return 'turborepo';
      if (fileExists(path.join(root, 'bazel-out'))) return 'bazel';

      const pkgJson = path.join(root, 'package.json');
      if (fileExists(pkgJson)) {
        const pkg = JSON.parse(readFile(pkgJson));
        if (pkg.workspaces) return 'yarn';
      }
    } catch {
      // fall through
    }

    return 'none';
  }

  private findPackages(root: string, tool: MonorepoAnalysis['tool']): WorkspacePackage[] {
    const packages: WorkspacePackage[] = [];

    try {
      const pkgJson = path.join(root, 'package.json');
      let workspacePatterns: string[] = [];

      if (fileExists(pkgJson)) {
        const pkg = JSON.parse(readFile(pkgJson));
        if (pkg.workspaces) {
          if (Array.isArray(pkg.workspaces)) {
            workspacePatterns = pkg.workspaces;
          } else if (pkg.workspaces.packages) {
            workspacePatterns = pkg.workspaces.packages;
          }
        }
      }

      // Parse pnpm-workspace.yaml
      const pnpmConfig = path.join(root, 'pnpm-workspace.yaml');
      if (fileExists(pnpmConfig)) {
        const content = readFile(pnpmConfig);
        const packageMatches = content.match(/packages:\s*\n((?:\s*-.*\n)*)/);
        if (packageMatches) {
          const lines = packageMatches[1].split('\n').filter(Boolean);
          for (const line of lines) {
            const match = line.match(/-\s*['"]([^'"]+)['"]/);
            if (match) workspacePatterns.push(match[1]);
          }
        }
      }

      // Resolve workspace patterns to actual packages
      const seen = new Set<string>();
      for (const pattern of workspacePatterns) {
        const globPattern = pattern.replace(/\/\*$/, '');
        try {
          const dirs = this.findDirectories(root, globPattern);
          for (const dir of dirs) {
            const subPkgJson = path.join(dir, 'package.json');
            if (fileExists(subPkgJson) && !seen.has(dir)) {
              seen.add(dir);
              try {
                const subPkg = JSON.parse(readFile(subPkgJson));
                packages.push({
                  name: subPkg.name || path.basename(dir),
                  path: path.relative(root, dir),
                  version: subPkg.version || '0.0.0',
                  dependencies: Object.keys(subPkg.dependencies || {}),
                  devDependencies: Object.keys(subPkg.devDependencies || {}),
                  peerDependencies: Object.keys(subPkg.peerDependencies || {}),
                  scripts: subPkg.scripts || {},
                  language: 'typescript',
                });
              } catch {
                // skip invalid package.json
              }
            }
          }
        } catch {
          // skip
        }
      }

      // If no workspace patterns found, check common locations
      if (workspacePatterns.length === 0) {
        const commonDirs = ['packages', 'apps', 'libs', 'services', 'modules', 'components'];
        for (const dir of commonDirs) {
          const fullPath = path.join(root, dir);
          if (fileExists(fullPath)) {
            try {
              const subDirs = this.findDirectories(root, dir);
              for (const subDir of subDirs) {
                const subPkgJson = path.join(subDir, 'package.json');
                if (fileExists(subPkgJson) && !seen.has(subDir)) {
                  seen.add(subDir);
                  try {
                    const subPkg = JSON.parse(readFile(subPkgJson));
                    packages.push({
                      name: subPkg.name || path.basename(subDir),
                      path: path.relative(root, subDir),
                      version: subPkg.version || '0.0.0',
                      dependencies: Object.keys(subPkg.dependencies || {}),
                      devDependencies: Object.keys(subPkg.devDependencies || {}),
                      peerDependencies: Object.keys(subPkg.peerDependencies || {}),
                      scripts: subPkg.scripts || {},
                      language: 'typescript',
                    });
                  } catch {
                    // skip
                  }
                }
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch {
      // root package.json not found
    }

    return packages;
  }

  private findDirectories(root: string, pattern: string): string[] {
    const parts = pattern.split('/');
    const results: string[] = [];

    const walk = (dir: string, idx: number) => {
      if (idx >= parts.length) {
        if (fileExists(path.join(dir, 'package.json'))) {
          results.push(dir);
        }
        return;
      }

      const part = parts[idx];
      if (part === '*') {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              walk(path.join(dir, entry.name), idx + 1);
            }
          }
        } catch {
          // skip
        }
      } else {
        walk(path.join(dir, part), idx + 1);
      }
    };

    walk(root, 0);
    return results;
  }

  private resolveDependencies(packages: WorkspacePackage[]): PackageDependency[] {
    const deps: PackageDependency[] = [];
    const pkgNames = new Set(packages.map((p) => p.name));

    for (const pkg of packages) {
      for (const dep of pkg.dependencies) {
        deps.push({
          from: pkg.name,
          to: dep,
          type: pkgNames.has(dep) ? 'workspace' : 'dependency',
          version: dep,
        });
      }
      for (const dep of pkg.devDependencies) {
        deps.push({
          from: pkg.name,
          to: dep,
          type: pkgNames.has(dep) ? 'workspace' : 'devDependency',
          version: dep,
        });
      }
      for (const dep of pkg.peerDependencies) {
        deps.push({
          from: pkg.name,
          to: dep,
          type: 'peerDependency',
          version: dep,
        });
      }
    }

    return deps;
  }

  private readRootConfig(root: string, tool: MonorepoAnalysis['tool']): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    try {
      const pkgJson = path.join(root, 'package.json');
      if (fileExists(pkgJson)) {
        const pkg = JSON.parse(readFile(pkgJson));
        config.name = pkg.name;
        config.version = pkg.version;
        config.workspaces = pkg.workspaces;
      }
    } catch {
      // skip
    }

    return config;
  }

  analyzeImpact(changedFiles: string[], allPackages?: WorkspacePackage[]): ImpactAnalysis {
    const packages = allPackages || this.analyze().packages;

    const affectedPackages = new Set<string>();
    const affectedDependents = new Set<string>();

    for (const file of changedFiles) {
      for (const pkg of packages) {
        if (file.startsWith(pkg.path)) {
          affectedPackages.add(pkg.name);
        }
      }
    }

    // Find packages that depend on affected ones
    const deps = this.resolveDependencies(packages);
    for (const dep of deps) {
      if (affectedPackages.has(dep.to) && dep.type === 'workspace') {
        affectedDependents.add(dep.from);
      }
    }

    let risk: ImpactAnalysis['risk'] = 'low';
    if (affectedDependents.size > 5) risk = 'high';
    else if (affectedDependents.size > 1) risk = 'medium';

    return {
      changedFiles,
      affectedPackages: Array.from(affectedPackages),
      affectedDependents: Array.from(affectedDependents),
      risk,
      summary: `Affects ${affectedPackages.size} package(s) and ${affectedDependents.size} dependent(s)`,
    };
  }
}

export function printMonorepo(): void {
  const analyzer = new MonorepoAnalyzer();
  const analysis = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow monorepo]\n'));

  if (analysis.tool === 'none' && analysis.packages.length === 0) {
    console.log(chalk.yellow('Not a monorepo or no workspace packages found.'));
    console.log();
    return;
  }

  console.log(chalk.bold(`Tool: ${analysis.tool}`));
  console.log(chalk.bold(`Packages: ${analysis.packages.length}`));
  console.log();

  if (analysis.packages.length > 0) {
    console.log(chalk.bold('Workspace Packages:'));
    for (const pkg of analysis.packages) {
      const wsDeps = analysis.dependencies.filter(
        (d) => d.from === pkg.name && d.type === 'workspace',
      ).length;
      console.log(`  ${chalk.cyan(pkg.name)} ${chalk.dim(`${pkg.version}`)} ${chalk.dim(`(${pkg.path})`)}`);
      if (wsDeps > 0) {
        console.log(chalk.dim(`    ${wsDeps} workspace dependencies`));
      }
    }
    console.log();

    // Cross-package dependencies
    const wsDeps = analysis.dependencies.filter((d) => d.type === 'workspace');
    if (wsDeps.length > 0) {
      console.log(chalk.bold('Cross-package Dependencies:'));
      for (const dep of wsDeps) {
        console.log(`  ${chalk.cyan(dep.from)} ${chalk.dim('→')} ${chalk.cyan(dep.to)}`);
      }
      console.log();
    }

    // Dependency graph summary
    const mostDependents = new Map<string, number>();
    for (const dep of wsDeps) {
      mostDependents.set(dep.to, (mostDependents.get(dep.to) || 0) + 1);
    }
    const sorted = Array.from(mostDependents.entries()).sort((a, b) => b[1] - a[1]);

    if (sorted.length > 0) {
      console.log(chalk.bold('Most Critical Packages (by dependents):'));
      for (const [pkg, count] of sorted.slice(0, 5)) {
        console.log(`  ${chalk.magenta(pkg)}: ${count} dependents`);
      }
    }
  }
  console.log();
}
