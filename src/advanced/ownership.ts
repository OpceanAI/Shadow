import { simpleGit } from 'simple-git';
import { findFiles, readFile } from '../utils/fs';
import { runCommandSafe } from '../utils/process';
import chalk from 'chalk';

export interface BlameInfo {
  author: string;
  email: string;
  linesChanged: number;
  lastModified: Date;
  commits: number;
}

export interface FileOwnership {
  file: string;
  primaryOwner: BlameInfo;
  contributors: BlameInfo[];
  totalLines: number;
  lastModified: Date;
}

export interface ModuleOwnership {
  module: string;
  owners: Array<{ author: string; email: string; files: number; lines: number }>;
  fileCount: number;
  totalLines: number;
  busFactor: number;
}

export interface KnowledgeSilo {
  author: string;
  email: string;
  files: number;
  percentage: number;
  isSilo: boolean;
}

export interface OwnershipReport {
  files: FileOwnership[];
  modules: ModuleOwnership[];
  busFactor: number;
  silos: KnowledgeSilo[];
  stats: {
    totalAuthors: number;
    totalFiles: number;
    dominantAuthor: string;
    orphanedFiles: number;
  };
}

export class OwnershipAnalyzer {
  async analyze(projectPath?: string): Promise<OwnershipReport> {
    const root = projectPath || process.cwd();
    const git = simpleGit(root);

    let isRepo = false;
    try {
      await git.status();
      isRepo = true;
    } catch {
      isRepo = false;
    }

    if (!isRepo) {
      return {
        files: [],
        modules: [],
        busFactor: 0,
        silos: [],
        stats: { totalAuthors: 0, totalFiles: 0, dominantAuthor: 'n/a', orphanedFiles: 0 },
      };
    }

    const sourceFiles = findFiles(root, [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
      '*.java', '*.cpp', '*.cc', '*.rb', '*.php', '*.swift',
    ]);

    const files: FileOwnership[] = [];

    for (const file of sourceFiles) {
      try {
        const relPath = file.replace(root, '').replace(/^\//, '');
        const blame = await git.raw(['blame', '--line-porcelain', file]);
        const blameData = this.parseBlame(blame);

        const totalLines = readFile(file).split('\n').length;

        const primaryOwner = blameData[0] || { author: 'unknown', email: '', linesChanged: 0, lastModified: new Date(), commits: 0 };

        files.push({
          file: relPath,
          primaryOwner,
          contributors: blameData,
          totalLines,
          lastModified: blameData.length > 0 ? blameData[0].lastModified : new Date(),
        });
      } catch {
        // skip
      }
    }

    const modules = this.aggregateModules(files);
    const authorStats = this.computeAuthorStats(files);
    const busFactor = this.computeBusFactor(authorStats);
    const silos = this.detectSilos(authorStats, files.length);

    return {
      files,
      modules,
      busFactor,
      silos,
      stats: {
        totalAuthors: authorStats.size,
        totalFiles: files.length,
        dominantAuthor: Array.from(authorStats.entries()).sort((a, b) => b[1].files - a[1].files)[0]?.[0] || 'n/a',
        orphanedFiles: files.filter((f) => f.contributors.length === 0).length,
      },
    };
  }

  private parseBlame(blameOutput: string): BlameInfo[] {
    const authorMap = new Map<string, BlameInfo>();
    const lines = blameOutput.split('\n');

    let currentAuthor = '';
    let currentEmail = '';
    let currentTime = 0;

    for (const line of lines) {
      if (line.startsWith('author ')) {
        currentAuthor = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        currentEmail = line.substring(12).replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ')) {
        currentTime = parseInt(line.substring(12), 10);
      } else if (line.startsWith('\t')) {
        const key = currentEmail || currentAuthor;
        const existing = authorMap.get(key);
        if (existing) {
          existing.linesChanged++;
          existing.commits++;
        } else {
          authorMap.set(key, {
            author: currentAuthor,
            email: currentEmail,
            linesChanged: 1,
            lastModified: new Date(currentTime * 1000),
            commits: 1,
          });
        }
      }
    }

    return Array.from(authorMap.values()).sort((a, b) => b.linesChanged - a.linesChanged);
  }

  private aggregateModules(files: FileOwnership[]): ModuleOwnership[] {
    const moduleMap = new Map<string, { owners: Map<string, { author: string; email: string; files: number; lines: number }>; fileCount: number; totalLines: number }>();

    for (const file of files) {
      const parts = file.file.split('/');
      const module = parts.length > 1 ? parts[0] : 'root';

      if (!moduleMap.has(module)) {
        moduleMap.set(module, { owners: new Map(), fileCount: 0, totalLines: 0 });
      }

      const m = moduleMap.get(module)!;
      m.fileCount++;
      m.totalLines += file.totalLines;

      const owner = file.primaryOwner;
      const ownerKey = owner.email || owner.author;
      const existing = m.owners.get(ownerKey);
      if (existing) {
        existing.files++;
        existing.lines += owner.linesChanged;
      } else {
        m.owners.set(ownerKey, {
          author: owner.author,
          email: owner.email,
          files: 1,
          lines: owner.linesChanged,
        });
      }
    }

    return Array.from(moduleMap.entries()).map(([module, data]) => ({
      module,
      owners: Array.from(data.owners.values()).sort((a, b) => b.files - a.files),
      fileCount: data.fileCount,
      totalLines: data.totalLines,
      busFactor: data.owners.size <= 2 ? 1 : Math.min(data.owners.size, 5),
    }));
  }

  private computeAuthorStats(files: FileOwnership[]): Map<string, { author: string; files: number; lines: number }> {
    const stats = new Map<string, { author: string; files: number; lines: number }>();

    for (const file of files) {
      for (const contributor of file.contributors) {
        const key = contributor.email || contributor.author;
        const existing = stats.get(key);
        if (existing) {
          existing.files++;
          existing.lines += contributor.linesChanged;
        } else {
          stats.set(key, {
            author: contributor.author,
            files: 1,
            lines: contributor.linesChanged,
          });
        }
      }
    }

    return stats;
  }

  private computeBusFactor(authorStats: Map<string, { author: string; files: number; lines: number }>): number {
    // Bus factor: number of people whose departure would threaten the project
    const threshold = 0.5; // 50% of codebase

    const sorted = Array.from(authorStats.entries())
      .map(([, v]) => v)
      .sort((a, b) => b.lines - a.lines);

    const totalLines = sorted.reduce((s, a) => s + a.lines, 0);
    let cumulative = 0;
    let busFactor = 0;

    for (const author of sorted) {
      cumulative += author.lines;
      busFactor++;
      if (cumulative / totalLines >= threshold) break;
    }

    return busFactor;
  }

  private detectSilos(
    authorStats: Map<string, { author: string; files: number; lines: number }>,
    totalFiles: number,
  ): KnowledgeSilo[] {
    const silos: KnowledgeSilo[] = [];

    for (const [, data] of authorStats.entries()) {
      const percentage = totalFiles > 0 ? data.files / totalFiles : 0;
      silos.push({
        author: data.author,
        email: '',
        files: data.files,
        percentage,
        isSilo: percentage > 0.3,
      });
    }

    return silos.sort((a, b) => b.files - a.files);
  }
}

export async function printOwnership(): Promise<void> {
  const analyzer = new OwnershipAnalyzer();
  const report = await analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow ownership]\n'));

  console.log(chalk.bold('Code Ownership Report:'));
  console.log(`  Files:       ${report.stats.totalFiles}`);
  console.log(`  Authors:     ${report.stats.totalAuthors}`);
  console.log(`  Dominant:    ${chalk.cyan(report.stats.dominantAuthor)}`);
  console.log(`  Bus Factor:  ${report.busFactor <= 2 ? chalk.red(String(report.busFactor)) : chalk.green(String(report.busFactor))}`);
  console.log();

  if (report.silos.length > 0) {
    console.log(chalk.bold('Knowledge Silos:'));
    for (const silo of report.silos.filter((s) => s.isSilo)) {
      console.log(`  ${chalk.yellow('⚠')} ${chalk.cyan(silo.author)}: ${silo.files} files (${(silo.percentage * 100).toFixed(0)}%)`);
    }
    if (report.silos.filter((s) => s.isSilo).length === 0) {
      console.log(`  ${chalk.green('✓')} No knowledge silos detected`);
    }
    console.log();
  }

  if (report.modules.length > 0) {
    console.log(chalk.bold('Module Ownership:'));
    for (const mod of report.modules.slice(0, 10)) {
      console.log(`  ${chalk.cyan(mod.module)}: ${mod.fileCount} files, ${mod.totalLines} LOC, BF=${mod.busFactor}`);
      const topOwners = mod.owners.slice(0, 3);
      for (const o of topOwners) {
        console.log(chalk.dim(`    ${o.author}: ${o.files} files, ${o.lines} lines`));
      }
    }
  }

  console.log();
}
