import { readFile, fileExists } from '../utils/fs';
import { findFiles } from '../utils/fs';
import * as path from 'path';

export interface CoverageReport {
  totalLines: number;
  coveredLines: number;
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  statementCoverage: number;
  files: FileCoverage[];
  uncoveredAreas: UncoveredArea[];
}

export interface FileCoverage {
  path: string;
  totalLines: number;
  coveredLines: number;
  lineCoverage: number;
  uncoveredLines: number[];
}

export interface UncoveredArea {
  file: string;
  lines: string;
  suggestion: string;
}

export class CoverageAnalyzer {
  private root: string;

  constructor(root?: string) {
    this.root = root || process.cwd();
  }

  async analyze(): Promise<CoverageReport | null> {
    if (fileExists(path.join(this.root, 'coverage', 'coverage-final.json'))) {
      return this.parseIstanbul(path.join(this.root, 'coverage', 'coverage-final.json'));
    }
    if (fileExists(path.join(this.root, 'coverage.json'))) {
      return this.parseIstanbul(path.join(this.root, 'coverage.json'));
    }
    if (fileExists(path.join(this.root, '.nyc_output', 'out.json'))) {
      return this.parseIstanbul(path.join(this.root, '.nyc_output', 'out.json'));
    }

    const covPyFiles = findFiles(this.root, ['coverage.json']);
    for (const f of covPyFiles) {
      try {
        const raw = readFile(f);
        const json = JSON.parse(raw);
        if (json.meta?.format === 2 || json.totals) {
          return this.parseCoveragePy(json);
        }
      } catch {
        // not a valid coverage file
      }
    }

    return null;
  }

  private parseIstanbul(filePath: string): CoverageReport {
    try {
      const raw = readFile(filePath);
      const data = JSON.parse(raw);
      const files: FileCoverage[] = [];
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let totalStatements = 0;
      let coveredStatements = 0;
      const uncoveredAreas: UncoveredArea[] = [];

      for (const [filePath, fileData] of Object.entries(data) as Array<[string, Record<string, unknown>]>) {
        const s = fileData.s as Record<string, number> | undefined;
        const b = fileData.b as Record<string, number[]> | undefined;
        const f = fileData.f as Record<string, number> | undefined;
        const statementMap = fileData.statementMap as Record<string, { start: { line: number } }> | undefined;

        if (!s) continue;

        const sValues = Object.values(s);
        const fileTotalLines = sValues.length;
        const fileCoveredLines = sValues.filter((v) => v > 0).length;

        files.push({
          path: this.shortenPath(filePath),
          totalLines: fileTotalLines,
          coveredLines: fileCoveredLines,
          lineCoverage: fileTotalLines > 0 ? (fileCoveredLines / fileTotalLines) * 100 : 0,
          uncoveredLines: Object.entries(s)
            .filter(([, v]) => v === 0)
            .map(([k]) => statementMap?.[k]?.start.line || 0)
            .filter((l) => l > 0),
        });

        totalLines += fileTotalLines;
        coveredLines += fileCoveredLines;

        if (b) {
          const bTotal = Object.keys(b).length;
          const bCovered = Object.values(b).filter((v: number[]) => v[0] > 0).length;
          totalBranches += bTotal;
          coveredBranches += bCovered;
        }

        if (f) {
          const fTotal = Object.keys(f).length;
          const fCovered = Object.values(f).filter((v: number) => v > 0).length;
          totalFunctions += fTotal;
          coveredFunctions += fCovered;
        }

        totalStatements += sValues.length;
        coveredStatements += fileCoveredLines;

        const fileUncovered = Object.entries(s)
          .filter(([, v]) => v === 0)
          .slice(0, 5);
        if (fileUncovered.length > 0) {
          uncoveredAreas.push({
            file: this.shortenPath(filePath),
            lines: fileUncovered
              .map(([k]) => String(statementMap?.[k]?.start.line || '?'))
              .join(', '),
            suggestion: `Write tests to cover lines in ${path.basename(filePath)}`,
          });
        }
      }

      return {
        totalLines,
        coveredLines,
        lineCoverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        branchCoverage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        functionCoverage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        statementCoverage: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
        files,
        uncoveredAreas,
      };
    } catch {
      return this.emptyReport();
    }
  }

  private parseCoveragePy(json: Record<string, unknown>): CoverageReport {
    try {
      const files: FileCoverage[] = [];
      let totalLines = 0;
      let coveredLines = 0;

      const totals = json.totals as Record<string, number> | undefined;
      const fileData = json.files as Record<string, Record<string, unknown>> | undefined;
      const uncoveredAreas: UncoveredArea[] = [];

      if (fileData) {
        for (const [fpath, fdata] of Object.entries(fileData)) {
          const summary = fdata.summary as Record<string, number> | undefined;
          const missingLines = fdata.missing_lines as number[] | undefined;

          if (summary) {
            const fTotal = summary.num_statements || 0;
            const fCovered = (summary.num_statements || 0) - (summary.missing_lines || 0);

            files.push({
              path: this.shortenPath(fpath),
              totalLines: fTotal,
              coveredLines: fCovered,
              lineCoverage: fTotal > 0 ? (fCovered / fTotal) * 100 : 0,
              uncoveredLines: missingLines || [],
            });

            totalLines += fTotal;
            coveredLines += fCovered;

            if (missingLines && missingLines.length > 0) {
              uncoveredAreas.push({
                file: this.shortenPath(fpath),
                lines: missingLines.slice(0, 10).join(', '),
                suggestion: `Write tests to cover missing lines in ${path.basename(fpath)}`,
              });
            }
          }
        }
      }

      return {
        totalLines,
        coveredLines,
        lineCoverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        branchCoverage: totals?.percent_covered ? (json as Record<string, number>).percent_covered || 0 : 0,
        functionCoverage: 0,
        statementCoverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        files,
        uncoveredAreas,
      };
    } catch {
      return this.emptyReport();
    }
  }

  suggestTests(threshold: number = 80): string[] {
    const report = this.emptyReport();
    const suggestions: string[] = [];

    if (report.lineCoverage < threshold) {
      suggestions.push(`Line coverage is ${report.lineCoverage.toFixed(1)}% (threshold: ${threshold}%)`);
    }

    for (const area of report.uncoveredAreas) {
      suggestions.push(`  ${area.file}: uncovered lines [${area.lines}]`);
    }

    if (report.branchCoverage < threshold) {
      suggestions.push(`Branch coverage is ${report.branchCoverage.toFixed(1)}%`);
    }

    return suggestions;
  }

  private shortenPath(filePath: string): string {
    if (filePath.startsWith(this.root)) {
      return filePath.slice(this.root.length).replace(/^\//, '');
    }
    return filePath;
  }

  private emptyReport(): CoverageReport {
    return {
      totalLines: 0,
      coveredLines: 0,
      lineCoverage: 0,
      branchCoverage: 0,
      functionCoverage: 0,
      statementCoverage: 0,
      files: [],
      uncoveredAreas: [],
    };
  }
}
