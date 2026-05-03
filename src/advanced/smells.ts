import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface CodeSmell {
  type: string;
  file: string;
  line: number;
  name: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  metrics: Record<string, number>;
}

export interface CodeSmellReport {
  smells: CodeSmell[];
  stats: {
    totalSmells: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    filesAffected: number;
  };
}

export class CodeSmellDetector {
  detect(projectPath?: string): CodeSmellReport {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java',
    ]);

    const smells: CodeSmell[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        smells.push(...this.detectLongMethod(content, file));
        smells.push(...this.detectLargeClass(content, file));
        smells.push(...this.detectLongParameterList(content, file));
        smells.push(...this.detectPrimitiveObsession(content, file));
        smells.push(...this.detectFeatureEnvy(content, file));
        smells.push(...this.detectDataClumps(content, file));
        smells.push(...this.detectGodClass(content, file));
        smells.push(...this.detectShotgunSurgery(content, file));
      } catch {
        // skip
      }
    }

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const affectedFiles = new Set<string>();

    for (const smell of smells) {
      byType[smell.type] = (byType[smell.type] || 0) + 1;
      bySeverity[smell.severity] = (bySeverity[smell.severity] || 0) + 1;
      affectedFiles.add(smell.file);
    }

    return {
      smells,
      stats: {
        totalSmells: smells.length,
        byType,
        bySeverity,
        filesAffected: affectedFiles.size,
      },
    };
  }

  private detectLongMethod(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Find function bodies and measure length
    let inFn = false;
    let fnName = '';
    let fnStart = 0;
    let fnLineCount = 0;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inFn) {
        const fnMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
        const pyMatch = line.match(/^def\s+(\w+)/);
        const goMatch = line.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/);

        if (fnMatch || pyMatch || goMatch) {
          fnName = fnMatch?.[1] || fnMatch?.[2] || pyMatch?.[1] || goMatch?.[1] || 'anonymous';
          fnStart = i + 1;
          fnLineCount = 1;
          inFn = true;
          braceDepth = 0;

          if (line.includes('{')) {
            braceDepth += (line.match(/\{/g) || []).length;
            braceDepth -= (line.match(/\}/g) || []).length;
            if (braceDepth <= 0 && line.includes('}')) {
              inFn = false;
              if (fnLineCount > 30) {
                smells.push(this.createSmell('Long Method', file, fnStart, fnName, 'medium',
                  `Method "${fnName}" is ${fnLineCount} lines long (threshold: 30)`, { lines: fnLineCount }));
              }
            }
          }
        }
      } else {
        fnLineCount++;

        if (line.includes('{')) braceDepth += (line.match(/\{/g) || []).length;
        if (line.includes('}')) braceDepth -= (line.match(/\}/g) || []).length;

        const trimmed = line.trim();
        if ((braceDepth <= 0 && trimmed.includes('}')) || (trimmed === '' && braceDepth === 0 && fnLineCount > 10)) {
          inFn = false;
          if (fnLineCount > 30) {
            smells.push(this.createSmell('Long Method', file, fnStart, fnName, 'medium',
              `Method "${fnName}" is ${fnLineCount} lines long (threshold: 30)`, { lines: fnLineCount }));
          }
        }
      }
    }

    // Python detection: indentation-based
    let inPyFn = false;
    let pyName = '';
    let pyStart = 0;
    let pyCount = 0;
    let pyBaseIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inPyFn) {
        const pyMatch = line.match(/^def\s+(\w+)/);
        if (pyMatch) {
          pyName = pyMatch[1];
          pyStart = i + 1;
          pyCount = 1;
          pyBaseIndent = line.search(/\S/);
          inPyFn = true;
        }
      } else {
        const indent = line.search(/\S/);
        if (indent <= pyBaseIndent && line.trim() !== '' && indent >= 0) {
          if (pyCount > 30) {
            smells.push(this.createSmell('Long Method', file, pyStart, pyName, 'medium',
              `Method "${pyName}" is ${pyCount} lines long (threshold: 30)`, { lines: pyCount }));
          }
          inPyFn = false;

          // Check if it's another def
          const pyMatch = line.match(/^def\s+(\w+)/);
          if (pyMatch) {
            pyName = pyMatch[1];
            pyStart = i + 1;
            pyCount = 1;
            pyBaseIndent = indent;
            inPyFn = true;
          }
        } else if (line.trim() !== '') {
          pyCount++;
        }
      }
    }

    return smells;
  }

  private detectLargeClass(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for class declarations and count methods
    const classMatches = content.match(/class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g);
    if (!classMatches) return smells;

    for (const classMatch of classMatches) {
      const className = classMatch.match(/class\s+(\w+)/)?.[1];
      if (!className) continue;

      // Count methods in class body (heuristic)
      const classStart = content.indexOf(classMatch);
      const afterClass = content.substring(classStart);

      let braceDepth = 0;
      let methodCount = 0;
      let propCount = 0;
      let endPos = 0;

      for (let i = 0; i < afterClass.length; i++) {
        if (afterClass[i] === '{') braceDepth++;
        if (afterClass[i] === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            endPos = i;
            break;
          }
        }
      }

      const classBody = afterClass.substring(0, endPos);
      const methodMatches = classBody.match(/(\w+)\s*\([^)]*\)\s*\{/g);
      if (methodMatches) methodCount = methodMatches.length;

      // Count properties
      const propMatches = classBody.match(/(?:public|private|protected|readonly)?\s*(\w+)\s*:\s*\w+/g);
      if (propMatches) propCount = propMatches.length;

      if (methodCount + propCount > 15) {
        smells.push(this.createSmell('Large Class', file, classStart, className, 'medium',
          `Class "${className}" has ${methodCount} methods and ${propCount} properties`, { methods: methodCount, properties: propCount }));
      }
    }

    return smells;
  }

  private detectLongParameterList(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // TypeScript/JS functions
      const fnMatch = line.match(/function\s+(\w+)\s*\(([^)]*)\)/);
      const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)/);

      const match = fnMatch || arrowMatch;
      if (match) {
        const fnName = match[1];
        const params = match[2].split(',').filter((p) => p.trim()).length;

        if (params > 4) {
          smells.push(this.createSmell('Long Parameter List', file, i + 1, fnName, 'low',
            `Function "${fnName}" has ${params} parameters (threshold: 4)`, { params }));
        }
      }

      // Python
      const pyMatch = line.match(/def\s+(\w+)\s*\(([^)]*)\)/);
      if (pyMatch) {
        const name = pyMatch[1];
        const params = pyMatch[2].split(',').filter((p) => p.trim() && !p.trim().startsWith('self')).length;
        if (params > 4) {
          smells.push(this.createSmell('Long Parameter List', file, i + 1, name, 'low',
            `Function "${name}" has ${params} parameters (threshold: 4)`, { params }));
        }
      }
    }

    return smells;
  }

  private detectPrimitiveObsession(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Look for repeated primitive usage patterns
    const primitives = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for repeated use of primitives without abstraction
      if (/string/.test(line)) primitives.set('string', (primitives.get('string') || 0) + 1);
      if (/\bnumber\b/.test(line)) primitives.set('number', (primitives.get('number') || 0) + 1);
      if (/boolean/.test(line)) primitives.set('boolean', (primitives.get('boolean') || 0) + 1);

      // Multiple if-else chains using the same string comparison
      const strComp = line.match(/if\s*\(\s*(\w+)\s*===\s*['"][^'"]+['"]/);
      if (strComp) {
        const varName = strComp[1];
        const count = (primitives.get(`strcomp_${varName}`) || 0) + 1;
        primitives.set(`strcomp_${varName}`, count);
      }
    }

    for (const [key, count] of primitives.entries()) {
      if (count > 10 && key.startsWith('strcomp_')) {
        const varName = key.replace('strcomp_', '');
        smells.push(this.createSmell('Primitive Obsession', file, 0, varName, 'low',
          `Repeated string comparison on "${varName}" (${count} times). Consider using enum or object lookup.`, { occurrences: count }));
      }
    }

    return smells;
  }

  private detectFeatureEnvy(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Feature envy: method calls another object's methods more than its own
    let inFn = false;
    let fnName = '';
    let fnStart = 0;
    const externalCalls: Map<string, number> = new Map();
    let selfCalls = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const callMatch = line.match(/(\w+)\.(\w+)\s*\(/g);
      if (callMatch) {
        for (const call of callMatch) {
          const objMatch = call.match(/(\w+)\./);
          if (objMatch) {
            const obj = objMatch[1];
            if (obj !== 'this' && obj !== 'self') {
              externalCalls.set(obj, (externalCalls.get(obj) || 0) + 1);
            } else {
              selfCalls++;
            }
          }
        }
      }

      // Check at function boundaries
      const fnEnd = line.match(/^\s*\}\s*$/);
      if (fnEnd && inFn) {
        for (const [obj, count] of externalCalls.entries()) {
          if (count > selfCalls && count > 3) {
            smells.push(this.createSmell('Feature Envy', file, fnStart, fnName, 'low',
              `Method "${fnName}" calls ${obj} methods ${count}x vs self calls ${selfCalls}x`, { externalCalls: count, selfCalls }));
          }
        }
        externalCalls.clear();
        selfCalls = 0;
      }
    }

    return smells;
  }

  private detectDataClumps(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Data clumps: same group of parameters appearing together
    const paramGroups = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const params = line.match(/\((.*?)\)/);
      if (params) {
        const paramList = params[1].split(',').map((p) => p.trim()).filter((p) => p && p.includes(':'));
        if (paramList.length >= 2) {
          const key = paramList.map((p) => p.split(':')[0].trim()).sort().join(',');
          paramGroups.set(key, (paramGroups.get(key) || 0) + 1);
        }
      }
    }

    for (const [key, count] of paramGroups.entries()) {
      if (count >= 3) {
        smells.push(this.createSmell('Data Clumps', file, 0, key, 'low',
          `Group "${key}" appears together in ${count} places. Consider creating a class/struct.`, { occurrences: count }));
      }
    }

    return smells;
  }

  private detectGodClass(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // God class: very large class with too many responsibilities
    const classPattern = /class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g;
    let match: RegExpExecArray | null;

    while ((match = classPattern.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;

      // Count lines in class
      let braceDepth = 0;
      let endPos = startPos;
      for (let i = startPos; i < content.length; i++) {
        if (content[i] === '{') braceDepth++;
        if (content[i] === '}') {
          braceDepth--;
          if (braceDepth === 0) { endPos = i; break; }
        }
      }

      const classBody = content.substring(startPos, endPos);
      const classLines = classBody.split('\n').length;

      // Count different concerns (imports, methods in different domains)
      const methodCount = (classBody.match(/\w+\s*\([^)]*\)\s*\{/g) || []).length;
      const stateCount = (classBody.match(/(?:public|private|protected)?\s*\w+\s*:\s*\w+/g) || []).length;

      if (classLines > 300 || methodCount > 20 || stateCount > 15) {
        smells.push(this.createSmell('God Class', file, startPos, className, 'high',
          `Class "${className}": ${classLines} lines, ${methodCount} methods, ${stateCount} states`, {
            lines: classLines, methods: methodCount, states: stateCount,
          }));
      }
    }

    return smells;
  }

  private detectShotgunSurgery(content: string, file: string): CodeSmell[] {
    const smells: CodeSmell[] = [];

    // Shotgun surgery: one change requires many small edits across many classes
    // Heuristic: many small classes/functions with similar names
    const functionNames = new Map<string, number>();

    const fnRegex = /(?:function|const|let|var)\s+(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = fnRegex.exec(content)) !== null) {
      const name = match[1];
      functionNames.set(name, (functionNames.get(name) || 0) + 1);
    }

    for (const [name, count] of functionNames.entries()) {
      if (count > 5 && count <= 15) {
        smells.push(this.createSmell('Shotgun Surgery', file, 0, name, 'medium',
          `Function "${name}" appears ${count} times across the codebase`, { occurrences: count }));
      }
    }

    return smells;
  }

  private createSmell(
    type: string,
    file: string,
    line: number,
    name: string,
    severity: 'high' | 'medium' | 'low',
    description: string,
    metrics: Record<string, number>,
  ): CodeSmell {
    return { type, file, line, name, severity, description, metrics };
  }
}

export function printSmells(): void {
  const detector = new CodeSmellDetector();
  const report = detector.detect();

  console.log(chalk.bold.blue('\n[shadow smells]\n'));

  console.log(chalk.bold('Code Smell Report:'));
  console.log(`  Total smells:   ${report.stats.totalSmells}`);
  console.log(`  Files affected: ${report.stats.filesAffected}`);

  if (Object.keys(report.stats.bySeverity).length > 0) {
    console.log(chalk.bold('\n  By Severity:'));
    for (const [sev, count] of Object.entries(report.stats.bySeverity)) {
      const color = sev === 'high' ? chalk.red : sev === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`    ${color(sev)}: ${count}`);
    }
  }

  if (Object.keys(report.stats.byType).length > 0) {
    console.log(chalk.bold('\n  By Type:'));
    for (const [type, count] of Object.entries(report.stats.byType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${chalk.magenta(type)}: ${count}`);
    }
  }

  if (report.smells.length > 0) {
    console.log(chalk.bold('\nDetected Smells:'));
    for (const smell of report.smells.slice(0, 15)) {
      const sevColor = smell.severity === 'high' ? chalk.red : smell.severity === 'medium' ? chalk.yellow : chalk.gray;
      console.log(`  ${sevColor(`[${smell.severity.toUpperCase()}]`)} ${chalk.white(smell.type)} - ${smell.name}`);
      console.log(chalk.dim(`    ${smell.file}:${smell.line} - ${smell.description}`));
    }
    if (report.smells.length > 15) {
      console.log(chalk.dim(`  ... and ${report.smells.length - 15} more`));
    }
  } else {
    console.log(chalk.green('\nNo code smells detected!'));
  }

  console.log();
}
