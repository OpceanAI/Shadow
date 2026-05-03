import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface DetectedPattern {
  name: string;
  category: 'creational' | 'structural' | 'behavioral' | 'architectural';
  confidence: number;
  file: string;
  line: number;
  evidence: string[];
}

export interface PatternReport {
  patterns: DetectedPattern[];
  stats: {
    total: number;
    byCategory: Record<string, number>;
    byPattern: Record<string, number>;
  };
}

export class PatternDetector {
  detect(projectPath?: string): PatternReport {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java',
    ]);

    const patterns: DetectedPattern[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        patterns.push(...this.detectSingleton(content, file));
        patterns.push(...this.detectFactory(content, file));
        patterns.push(...this.detectBuilder(content, file));
        patterns.push(...this.detectObserver(content, file));
        patterns.push(...this.detectStrategy(content, file));
        patterns.push(...this.detectDecorator(content, file));
        patterns.push(...this.detectAdapter(content, file));
        patterns.push(...this.detectFacade(content, file));
        patterns.push(...this.detectProxy(content, file));
        patterns.push(...this.detectRepository(content, file));
        patterns.push(...this.detectDependencyInjection(content, file));
        patterns.push(...this.detectMVC(content, file));
      } catch {
        // skip
      }
    }

    const byCategory: Record<string, number> = {};
    const byPattern: Record<string, number> = {};

    for (const p of patterns) {
      byCategory[p.category] = (byCategory[p.category] || 0) + 1;
      byPattern[p.name] = (byPattern[p.name] || 0) + 1;
    }

    return {
      patterns,
      stats: {
        total: patterns.length,
        byCategory,
        byPattern,
      },
    };
  }

  private detectSingleton(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // TypeScript: private static instance
      if (/private\s+static\s+instance\s*:/.test(line)) {
        patterns.push({
          name: 'Singleton',
          category: 'creational',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Private static instance variable', 'getInstance() method'],
        });
      }

      // getInstance pattern
      if (/getInstance\s*\(/.test(line) || /static\s+getInstance/.test(line)) {
        patterns.push({
          name: 'Singleton',
          category: 'creational',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['getInstance() method'],
        });
      }

      // Python singleton
      if (/class\s+\w+Singleton/.test(line) || /_instance\s*=\s*None/.test(line)) {
        patterns.push({
          name: 'Singleton',
          category: 'creational',
          confidence: 0.5,
          file,
          line: i + 1,
          evidence: ['Class named *Singleton', 'has _instance'],
        });
      }
    }

    return patterns;
  }

  private detectFactory(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Factory)/.test(line)) {
        const name = line.match(/class\s+(\w*Factory)/)?.[1] || 'Factory';
        patterns.push({
          name: 'Factory Method',
          category: 'creational',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: [`Class named ${name}`],
        });
      }

      const fnMatch = line.match(/(?:create|make|build|new)\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/);
      if (fnMatch && /return\s+new\s+\w+/.test(content.substring(content.indexOf(line)))) {
        patterns.push({
          name: 'Factory Method',
          category: 'creational',
          confidence: 0.6,
          file,
          line: i + 1,
          evidence: ['Method creates and returns new instances'],
        });
      }

      if (/AbstractFactory/.test(content) || /abstract\s+class\s+\w*Factory/.test(content)) {
        patterns.push({
          name: 'Abstract Factory',
          category: 'creational',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Abstract factory class'],
        });
      }
    }

    return patterns;
  }

  private detectBuilder(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Builder)/.test(line)) {
        const name = line.match(/class\s+(\w*Builder)/)?.[1] || 'Builder';
        patterns.push({
          name: 'Builder',
          category: 'creational',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: [`Class named ${name}`],
        });
      }

      // Check for fluent interface pattern (.withX() or .setX() returning this)
      const fluentPattern = /\.(?:with|set)\w+\(/.test(line) && /return\s+this/.test(content);
      if (fluentPattern) {
        patterns.push({
          name: 'Builder',
          category: 'creational',
          confidence: 0.5,
          file,
          line: i + 1,
          evidence: ['Fluent interface with chaining'],
        });
      }
    }

    return patterns;
  }

  private detectObserver(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Observer)/.test(line)) {
        patterns.push({
          name: 'Observer',
          category: 'behavioral',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Class named *Observer'],
        });
      }

      if (/addEventListener|on\(|subscribe\(|addObserver|\.emit\(|dispatch\(/.test(line)) {
        patterns.push({
          name: 'Observer',
          category: 'behavioral',
          confidence: 0.4,
          file,
          line: i + 1,
          evidence: ['Event subscription pattern'],
        });
      }

      // Subject/Observable pattern
      if (/\bSubject\b/.test(line) || /\bObservable\b/.test(line)) {
        patterns.push({
          name: 'Observer',
          category: 'behavioral',
          confidence: 0.6,
          file,
          line: i + 1,
          evidence: ['Implements Subject/Observable'],
        });
      }
    }

    return patterns;
  }

  private detectStrategy(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Strategy)/.test(line)) {
        const name = line.match(/class\s+(\w*Strategy)/)?.[1] || 'Strategy';
        patterns.push({
          name: 'Strategy',
          category: 'behavioral',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: [`Class named ${name}`],
        });
      }

      // Strategy interfaces with multiple implementations
      const ifaceMatch = line.match(/interface\s+(\w*(?:Strategy|Protocol|Policy|Algorithm))/);
      if (ifaceMatch) {
        patterns.push({
          name: 'Strategy',
          category: 'behavioral',
          confidence: 0.6,
          file,
          line: i + 1,
          evidence: [`Strategy/Policy interface: ${ifaceMatch[1]}`],
        });
      }
    }

    return patterns;
  }

  private detectDecorator(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Decorator)/.test(line)) {
        patterns.push({
          name: 'Decorator',
          category: 'structural',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Class named *Decorator'],
        });
      }

      // Python decorators
      if (/^@\w+/.test(line.trim())) {
        patterns.push({
          name: 'Decorator',
          category: 'structural',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Uses @decorator syntax'],
        });
      }

      // TypeScript decorators (@Component, @Injectable, etc.)
      if (/^@\w+/.test(line.trim()) && !line.trim().startsWith('@Override')) {
        patterns.push({
          name: 'Decorator',
          category: 'structural',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Uses @decorator syntax'],
        });
      }
    }

    return patterns;
  }

  private detectAdapter(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Adapter)/.test(line)) {
        patterns.push({
          name: 'Adapter',
          category: 'structural',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Class named *Adapter'],
        });
      }

      if (/implements\s+\w+Adapter/.test(line)) {
        patterns.push({
          name: 'Adapter',
          category: 'structural',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Implements adapter interface'],
        });
      }
    }

    return patterns;
  }

  private detectFacade(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Facade)/.test(line)) {
        patterns.push({
          name: 'Facade',
          category: 'structural',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Class named *Facade'],
        });
      }
    }

    return patterns;
  }

  private detectProxy(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Proxy)/.test(line)) {
        patterns.push({
          name: 'Proxy',
          category: 'structural',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Class named *Proxy'],
        });
      }

      if (/new\s+Proxy\s*\(/.test(line)) {
        patterns.push({
          name: 'Proxy',
          category: 'structural',
          confidence: 0.9,
          file,
          line: i + 1,
          evidence: ['Uses JavaScript Proxy'],
        });
      }
    }

    return patterns;
  }

  private detectRepository(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/class\s+(\w*Repository)/.test(line)) {
        patterns.push({
          name: 'Repository',
          category: 'architectural',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Class named *Repository'],
        });
      }

      if (/@Repository/.test(line)) {
        patterns.push({
          name: 'Repository',
          category: 'architectural',
          confidence: 0.9,
          file,
          line: i + 1,
          evidence: ['@Repository decorator'],
        });
      }
    }

    return patterns;
  }

  private detectDependencyInjection(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/@Injectable/.test(line) || /@Component/.test(line)) {
        patterns.push({
          name: 'Dependency Injection',
          category: 'architectural',
          confidence: 0.9,
          file,
          line: i + 1,
          evidence: ['@Injectable or @Component decorator'],
        });
      }

      if (/constructor\s*\([^)]*:\s*\w+\)/.test(line)) {
        patterns.push({
          name: 'Dependency Injection',
          category: 'architectural',
          confidence: 0.5,
          file,
          line: i + 1,
          evidence: ['Constructor injection'],
        });
      }
    }

    return patterns;
  }

  private detectMVC(content: string, file: string): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/@Controller/.test(line) || /class\s+\w+Controller/.test(line)) {
        patterns.push({
          name: 'MVC',
          category: 'architectural',
          confidence: 0.8,
          file,
          line: i + 1,
          evidence: ['Controller class'],
        });
      }

      if (/class\s+\w+View/.test(line) || /class\s+\w+Model/.test(line)) {
        patterns.push({
          name: 'MVC',
          category: 'architectural',
          confidence: 0.7,
          file,
          line: i + 1,
          evidence: ['Model/View class'],
        });
      }
    }

    return patterns;
  }
}

export function printPatterns(): void {
  const detector = new PatternDetector();
  const report = detector.detect();

  console.log(chalk.bold.blue('\n[shadow patterns]\n'));

  console.log(chalk.bold('Design Patterns Report:'));
  console.log(`  Total patterns found: ${report.stats.total}`);

  if (Object.keys(report.stats.byCategory).length > 0) {
    console.log(chalk.bold('\n  By Category:'));
    for (const [cat, count] of Object.entries(report.stats.byCategory)) {
      console.log(`    ${chalk.cyan(cat)}: ${count}`);
    }
  }

  if (Object.keys(report.stats.byPattern).length > 0) {
    console.log(chalk.bold('\n  By Pattern Type:'));
    for (const [name, count] of Object.entries(report.stats.byPattern).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${chalk.magenta(name)}: ${count}`);
    }
  }

  if (report.patterns.length > 0) {
    console.log(chalk.bold('\nDetected Patterns:'));
    for (const p of report.patterns.slice(0, 20)) {
      const confColor = p.confidence > 0.7 ? chalk.green : p.confidence > 0.5 ? chalk.yellow : chalk.gray;
      console.log(`  ${confColor(`[${(p.confidence * 100).toFixed(0)}%]`)} ${chalk.white(p.name)} ${chalk.dim(`(${p.category})`)}`);
      console.log(chalk.dim(`    ${p.file}:${p.line}`));
    }
    if (report.patterns.length > 20) {
      console.log(chalk.dim(`  ... and ${report.patterns.length - 20} more`));
    }
  } else {
    console.log(chalk.yellow('\nNo design patterns detected.'));
  }

  console.log();
}
