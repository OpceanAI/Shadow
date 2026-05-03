import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface AntiPattern {
  name: string;
  category: string;
  file: string;
  line: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  recommendation: string;
}

export interface AntiPatternReport {
  antiPatterns: AntiPattern[];
  stats: {
    total: number;
    byName: Record<string, number>;
    bySeverity: Record<string, number>;
    filesAffected: number;
  };
}

export class AntiPatternDetector {
  detect(projectPath?: string): AntiPatternReport {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const antiPatterns: AntiPattern[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        antiPatterns.push(...this.detectSpaghettiCode(content, file));
        antiPatterns.push(...this.detectMagicNumbers(content, file));
        antiPatterns.push(...this.detectHardCoding(content, file));
        antiPatterns.push(...this.detectCopyPaste(content, file));
        antiPatterns.push(...this.detectGoldenHammer(content, file));
        antiPatterns.push(...this.detectCargoCult(content, file));
        antiPatterns.push(...this.detectReinventingWheel(content, file));
      } catch {
        // skip
      }
    }

    const byName: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const filesAffected = new Set<string>();

    for (const ap of antiPatterns) {
      byName[ap.name] = (byName[ap.name] || 0) + 1;
      bySeverity[ap.severity] = (bySeverity[ap.severity] || 0) + 1;
      filesAffected.add(ap.file);
    }

    return {
      antiPatterns,
      stats: {
        total: antiPatterns.length,
        byName,
        bySeverity,
        filesAffected: filesAffected.size,
      },
    };
  }

  private detectSpaghettiCode(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = content.split('\n');

    // Deeply nested code (5+ levels)
    let maxNesting = 0;
    let currentNesting = 0;
    let worstLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/\{\s*$/.test(line.trim()) || /\b(?:if|for|while|try|switch)\b/.test(line.trim())) {
        currentNesting++;
        if (currentNesting > maxNesting) {
          maxNesting = currentNesting;
          worstLine = i + 1;
        }
      }
      if (/^\s*\}.*$/.test(line.trim())) {
        currentNesting = Math.max(0, currentNesting - 1);
      }
    }

    if (maxNesting > 4) {
      patterns.push({
        name: 'Spaghetti Code',
        category: 'code-structure',
        file,
        line: worstLine,
        severity: 'high',
        description: `Maximum nesting depth of ${maxNesting} levels detected`,
        recommendation: 'Extract nested blocks into separate functions. Aim for max 3 levels of nesting.',
      });
    }

    // Very long files
    if (lines.length > 800) {
      patterns.push({
        name: 'Spaghetti Code',
        category: 'code-structure',
        file,
        line: 1,
        severity: 'medium',
        description: `File is ${lines.length} lines long - hard to understand and maintain`,
        recommendation: 'Split into smaller, focused modules.',
      });
    }

    return patterns;
  }

  private detectMagicNumbers(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments, imports, logging
      if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;
      if (line.includes('import ') || line.includes('require(')) continue;
      if (line.includes('console.')) continue;

      // Find numeric literals in suspicious contexts
      const numMatches = line.match(/(?<![a-zA-Z0-9_."'`-])(\d{3,})(?![a-zA-Z0-9_])/g);
      if (numMatches) {
        for (const num of numMatches) {
          const val = parseInt(num, 10);
          // Skip likely array indices, line numbers, etc.
          if (val <= 0 || val === 100) continue;

          patterns.push({
            name: 'Magic Numbers',
            category: 'maintainability',
            file,
            line: i + 1,
            severity: 'low',
            description: `Magic number "${num}" found without explanation`,
            recommendation: 'Replace with a named constant to explain its meaning.',
          });
        }
      }

      // Hard-coded timeouts, limits
      const timeoutMatch = line.match(/setTimeout\s*\(\s*\w+\s*,\s*(\d+)\s*\)/);
      if (timeoutMatch && parseInt(timeoutMatch[1], 10) > 100) {
        patterns.push({
          name: 'Magic Numbers',
          category: 'maintainability',
          file,
          line: i + 1,
          severity: 'low',
          description: `Timeout value ${timeoutMatch[1]}ms without named constant`,
          recommendation: 'Extract timeout duration to a named constant.',
        });
      }
    }

    return patterns;
  }

  private detectHardCoding(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Hard-coded URLs
      const urlMatch = line.match(/['"](https?:\/\/[^'"]+)['"]/);
      if (urlMatch && !line.includes('import ') && !line.includes('require(') && !line.includes('//') && !line.includes('*')) {
        patterns.push({
          name: 'Hard Coding',
          category: 'configuration',
          file,
          line: i + 1,
          severity: 'medium',
          description: `Hard-coded URL: ${urlMatch[1].slice(0, 50)}`,
          recommendation: 'Use environment variables or configuration files for URLs.',
        });
      }

      // Hard-coded file paths
      const pathMatch = line.match(/['"](\/[a-zA-Z0-9\/._-]+)['"]/);
      if (pathMatch && !line.includes('import ') && !line.includes('require(')) {
        patterns.push({
          name: 'Hard Coding',
          category: 'configuration',
          file,
          line: i + 1,
          severity: 'low',
          description: `Hard-coded file path: ${pathMatch[1]}`,
          recommendation: 'Use relative paths or configuration-driven paths.',
        });
      }

      // Hard-coded API keys / tokens (heuristic)
      const keyMatch = line.match(/(?:apiKey|api_key|apikey|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]?\s*[;,)]?/i);
      if (keyMatch && !line.includes('process.env') && !line.includes('config')) {
        patterns.push({
          name: 'Hard Coding',
          category: 'security',
          file,
          line: i + 1,
          severity: 'high',
          description: 'Potential hard-coded credential detected',
          recommendation: 'Move secrets to environment variables or a secure vault.',
        });
      }
    }

    return patterns;
  }

  private detectCopyPaste(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const lines = content.split('\n');

    // Detect repeated blocks of similar code
    const blocks = new Map<string, number>();

    for (let i = 0; i < lines.length - 3; i++) {
      const block = lines.slice(i, i + 3).map((l) => l.trim()).join('\n');
      if (block.length > 30) {
        blocks.set(block, (blocks.get(block) || 0) + 1);
      }
    }

    for (const [block, count] of blocks.entries()) {
      if (count >= 3 && block.length > 50) {
        patterns.push({
          name: 'Copy-Paste Programming',
          category: 'duplication',
          file,
          line: 0,
          severity: 'medium',
          description: `Repeated code block found ${count} times`,
          recommendation: 'Extract repeated code into a shared function or utility.',
        });
      }
    }

    return patterns;
  }

  private detectGoldenHammer(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    // Golden hammer: using the same tool/library for everything even when inappropriate
    // Check for regex when simpler string methods would suffice
    const regexCount = (content.match(/new\s+RegExp\s*\(/g) || []).length;
    const stringMethodCount = (content.match(/\.includes\(/g) || []).length;

    if (regexCount > 5 && stringMethodCount === 0) {
      patterns.push({
        name: 'Golden Hammer',
        category: 'design',
        file,
        line: 0,
        severity: 'low',
        description: `Uses ${regexCount} RegExp constructions where string methods could be simpler`,
        recommendation: 'Consider using .includes(), .startsWith(), .endsWith() for simple string matching.',
      });
    }

    return patterns;
  }

  private detectCargoCult(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    // Cargo cult: blindly copying code without understanding
    // Indicators: commented-out code blocks, TODO without explanation
    if ((content.match(/\/\/\s*TODO/g) || []).length > 5) {
      patterns.push({
        name: 'Cargo Cult Programming',
        category: 'process',
        file,
        line: 0,
        severity: 'low',
        description: 'Many TODO comments without explanation - code may be copied without understanding',
        recommendation: 'Document why each TODO exists and what needs to be done.',
      });
    }

    const commentedCode = (content.match(/\/\/\s*(?:const|let|var|function|if|for|while)\s/g) || []).length;
    if (commentedCode > 10) {
      patterns.push({
        name: 'Cargo Cult Programming',
        category: 'process',
        file,
        line: 0,
        severity: 'medium',
        description: `${commentedCode} commented-out code lines - code left without understanding if needed`,
        recommendation: 'Remove commented-out code; use version control to recover if needed.',
      });
    }

    return patterns;
  }

  private detectReinventingWheel(content: string, file: string): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    // Look for implementations of things available in standard libraries
    const commonReimplementations = [
      { pattern: /function\s+(?:deepClone|cloneDeep|deepCopy)\s*\(/, name: 'deepClone' },
      { pattern: /function\s+(?:debounce|throttle)\s*\(/, name: 'debounce/throttle' },
      { pattern: /function\s+(?:formatDate|dateFormat)\s*\(/, name: 'date formatting' },
      { pattern: /function\s+(?:parseCSV|csvParse)\s*\(/, name: 'CSV parsing' },
      { pattern: /function\s+(?:capitalize|capitalizeFirst)\s*\(/, name: 'string capitalization' },
      { pattern: /function\s+(?:uuid|generateUUID|guid)\s*\(/, name: 'UUID generation' },
    ];

    for (const { pattern, name } of commonReimplementations) {
      if (pattern.test(content)) {
        patterns.push({
          name: 'Reinventing the Wheel',
          category: 'design',
          file,
          line: 0,
          severity: 'medium',
          description: `Custom ${name} implementation detected`,
          recommendation: `Use a well-tested library for ${name} instead of maintaining custom code.`,
        });
      }
    }

    return patterns;
  }
}

export function printAntiPatterns(): void {
  const detector = new AntiPatternDetector();
  const report = detector.detect();

  console.log(chalk.bold.blue('\n[shadow antipatterns]\n'));

  console.log(chalk.bold('Anti-Pattern Report:'));
  console.log(`  Total found:    ${report.stats.total}`);
  console.log(`  Files affected: ${report.stats.filesAffected}`);

  if (Object.keys(report.stats.bySeverity).length > 0) {
    console.log(chalk.bold('\n  By Severity:'));
    for (const [sev, count] of Object.entries(report.stats.bySeverity)) {
      const color = sev === 'high' ? chalk.red : sev === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`    ${color(sev)}: ${count}`);
    }
  }

  if (Object.keys(report.stats.byName).length > 0) {
    console.log(chalk.bold('\n  By Type:'));
    for (const [name, count] of Object.entries(report.stats.byName).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${chalk.magenta(name)}: ${count}`);
    }
  }

  if (report.antiPatterns.length > 0) {
    console.log(chalk.bold('\nDetected Anti-Patterns:'));
    for (const ap of report.antiPatterns.slice(0, 15)) {
      const sevColor = ap.severity === 'high' ? chalk.red : ap.severity === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`  ${sevColor(`[${ap.severity.toUpperCase()}]`)} ${chalk.white(ap.name)}`);
      console.log(chalk.dim(`    ${ap.file}:${ap.line} - ${ap.description}`));
      console.log(chalk.dim(`    Fix: ${ap.recommendation}`));
    }
    if (report.antiPatterns.length > 15) {
      console.log(chalk.dim(`  ... and ${report.antiPatterns.length - 15} more`));
    }
  } else {
    console.log(chalk.green('\nNo anti-patterns detected!'));
  }

  console.log();
}
