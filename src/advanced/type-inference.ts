import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface InferredType {
  name: string;
  type: string;
  confidence: number;
  source: 'jsdoc' | 'usage' | 'assignment' | 'context';
  file: string;
  line: number;
}

export interface TypeScriptDeclaration {
  interface: string;
  file: string;
}

export interface TypeMismatch {
  variable: string;
  expected: string;
  found: string;
  file: string;
  line: number;
  confidence: number;
}

export interface TypeInferenceResult {
  inferredTypes: InferredType[];
  declarations: TypeScriptDeclaration[];
  mismatches: TypeMismatch[];
}

export class TypeInferenceEngine {
  private jsdocMap: Record<string, string> = {
    '{string}': 'string',
    '{number}': 'number',
    '{boolean}': 'boolean',
    '{void}': 'void',
    '{any}': 'any',
    '{object}': 'object',
    '{array}': 'Array<unknown>',
    '{function}': '(...args: unknown[]) => unknown',
    '{Promise}': 'Promise<unknown>',
    '{Date}': 'Date',
    '{RegExp}': 'RegExp',
    '{Error}': 'Error',
    '{Buffer}': 'Buffer',
    '{string[]}': 'string[]',
    '{number[]}': 'number[]',
  };

  infer(projectPath?: string): TypeInferenceResult {
    const files = findFiles(projectPath || process.cwd(), [
      '*.js', '*.jsx', '*.ts', '*.tsx',
    ]);

    const inferredTypes: InferredType[] = [];
    const declarations: TypeScriptDeclaration[] = [];
    const mismatches: TypeMismatch[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        inferredTypes.push(...this.inferFromJSDoc(content, file));
        inferredTypes.push(...this.inferFromUsage(content, file));
        inferredTypes.push(...this.inferFromAssignment(content, file));
        mismatches.push(...this.detectMismatches(content, file));
      } catch {
        // skip
      }
    }

    declarations.push(...this.generateDeclarations(inferredTypes));

    return { inferredTypes, declarations, mismatches };
  }

  private inferFromJSDoc(content: string, file: string): InferredType[] {
    const inferred: InferredType[] = [];
    const lines = content.split('\n');

    let currentJsdoc = '';
    let jsdocStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('/**')) {
        currentJsdoc = line;
        jsdocStartLine = i + 1;
      } else if (line.startsWith('*') && currentJsdoc) {
        currentJsdoc += '\n' + line;
      } else if (line.startsWith('*/') && currentJsdoc) {
        currentJsdoc += '\n' + line;
      } else if (currentJsdoc && !line.startsWith('*')) {
        const jsdocType = currentJsdoc.match(/@(?:param|returns|type)\s+\{([^}]+)\}/);
        if (jsdocType) {
          const tsType = this.jsdocToTs(jsdocType[1]);
          if (tsType) {
            const nextLine = lines[i] || '';
            const nameMatch = nextLine.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+))/);

            if (nameMatch) {
              const name = nameMatch[1] || nameMatch[2];
              if (name) {
                inferred.push({
                  name,
                  type: tsType,
                  confidence: 0.8,
                  source: 'jsdoc',
                  file,
                  line: jsdocStartLine,
                });
              }
            }

            const paramTag = currentJsdoc.match(/@param\s+\{([^}]+)\}\s+(\w+)/g);
            if (paramTag) {
              for (const pt of paramTag) {
                const pmMatch = pt.match(/@param\s+\{([^}]+)\}\s+(\w+)/);
                if (pmMatch) {
                  const paramType = this.jsdocToTs(pmMatch[1]);
                  if (paramType) {
                    inferred.push({
                      name: pmMatch[2],
                      type: paramType,
                      confidence: 0.8,
                      source: 'jsdoc',
                      file,
                      line: jsdocStartLine,
                    });
                  }
                }
              }
            }
          }
        }
        currentJsdoc = '';
      }
    }

    return inferred;
  }

  private jsdocToTs(jsdocType: string): string | null {
    return this.jsdocMap[`{${jsdocType}}`] || jsdocType;
  }

  private inferFromUsage(content: string, file: string): InferredType[] {
    const inferred: InferredType[] = [];
    const lines = content.split('\n');

    const stringMethods = ['.length', '.toLowerCase', '.toUpperCase', '.trim', '.slice', '.substring', '.replace', '.split', '.includes', '.startsWith', '.endsWith', '.match', '.indexOf', '.charAt', '.concat'];

    const numberOps = ['+', '-', '*', '/', '%', '++', '--', '+=', '-=', '*=', '/=', '%='];
    const numberMethods = ['.toFixed', '.toPrecision', '.toString'];

    const arrayMethods = ['.push', '.pop', '.shift', '.unshift', '.splice', '.map', '.filter', '.reduce', '.forEach', '.find', '.some', '.every', '.sort', '.reverse'];

    const booleans = ['===', '!==', '==', '!=', '>', '<', '>=', '<=', '&&', '||', '!'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(.+?)(?:;|$)/);
      if (!varMatch) continue;

      const varName = varMatch[1];
      const value = varMatch[2].trim();

      // Infer string
      if (value.startsWith("'") || value.startsWith('"') || value.startsWith('`')) {
        inferred.push({ name: varName, type: 'string', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      } else if (/^\d+$/.test(value) || /^\d+\.\d+$/.test(value)) {
        inferred.push({ name: varName, type: 'number', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      } else if (value === 'true' || value === 'false') {
        inferred.push({ name: varName, type: 'boolean', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      } else if (value === 'null') {
        inferred.push({ name: varName, type: 'null', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      } else if (value === 'undefined') {
        inferred.push({ name: varName, type: 'undefined', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        inferred.push({ name: varName, type: 'Array<unknown>', confidence: 0.7, source: 'assignment', file, line: i + 1 });
      } else if (value.startsWith('{') && value.endsWith('}')) {
        inferred.push({ name: varName, type: 'object', confidence: 0.7, source: 'assignment', file, line: i + 1 });
      } else if (value.startsWith('(') && value.endsWith(')') && value.includes('=>')) {
        inferred.push({ name: varName, type: '(...args: unknown[]) => unknown', confidence: 0.8, source: 'assignment', file, line: i + 1 });
      } else if (value.startsWith('function')) {
        inferred.push({ name: varName, type: '(...args: unknown[]) => unknown', confidence: 0.9, source: 'assignment', file, line: i + 1 });
      }

      // Usage-based inference: check lines after the variable
      for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
        const laterLine = lines[j];

        if (laterLine.includes(`${varName}.`)) {
          for (const method of stringMethods) {
            if (laterLine.includes(`${varName}${method}`)) {
              inferred.push({ name: varName, type: 'string', confidence: 0.5, source: 'usage', file, line: i + 1 });
            }
          }
          for (const method of arrayMethods) {
            if (laterLine.includes(`${varName}${method}`)) {
              inferred.push({ name: varName, type: 'Array<unknown>', confidence: 0.5, source: 'usage', file, line: i + 1 });
            }
          }
        }

        if (laterLine.includes(`${varName} = `)) {
          const reassign = laterLine.split(`${varName} = `)[1]?.trim();
          if (reassign) {
            if (/^\d+$/.test(reassign) || /^\d+\.\d+$/.test(reassign)) {
              inferred.push({ name: varName, type: 'number', confidence: 0.3, source: 'usage', file, line: i + 1 });
            } else if (reassign.startsWith("'") || reassign.startsWith('"')) {
              inferred.push({ name: varName, type: 'string', confidence: 0.3, source: 'usage', file, line: i + 1 });
            }
          }
        }
      }
    }

    return inferred;
  }

  private inferFromAssignment(content: string, file: string): InferredType[] {
    const inferred: InferredType[] = [];
    const lines = content.split('\n');

    const knownFunctions = ['.charAt(', '.charCodeAt(', '.concat(', '.includes(', '.endsWith(', '.indexOf(', '.lastIndexOf(', '.localeCompare(', '.match(', '.replace(', '.search(', '.slice(', '.split(', '.substring(', '.toLowerCase(', '.toUpperCase(', '.trim(', '.toString(', '.valueOf('];

    const knownNumberFunctions = ['.toFixed(', '.toExponential(', '.toPrecision('];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const func of knownFunctions) {
        const idx = line.indexOf(func);
        if (idx > 0) {
          const varName = line.substring(0, idx).match(/(\w+)$/)?.[1];
          if (varName) {
            inferred.push({ name: varName, type: 'string', confidence: 0.4, source: 'usage', file, line: i + 1 });
          }
        }
      }

      for (const func of knownNumberFunctions) {
        const idx = line.indexOf(func);
        if (idx > 0) {
          const varName = line.substring(0, idx).match(/(\w+)$/)?.[1];
          if (varName) {
            inferred.push({ name: varName, type: 'number', confidence: 0.4, source: 'usage', file, line: i + 1 });
          }
        }
      }

      if (line.includes('.then(') || line.includes('await')) {
        const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*await/);
        if (varMatch) {
          inferred.push({ name: varMatch[1], type: 'Promise<unknown>', confidence: 0.5, source: 'context', file, line: i + 1 });
        }
      }

      if (line.includes('new ') && /new\s+(\w+)/.test(line)) {
        const newMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*new/);
        if (newMatch) {
          const className = line.match(/new\s+(\w+)/)?.[1];
          inferred.push({ name: newMatch[1], type: className || 'object', confidence: 0.6, source: 'context', file, line: i + 1 });
        }
      }
    }

    return inferred;
  }

  private detectMismatches(content: string, file: string): TypeMismatch[] {
    const mismatches: TypeMismatch[] = [];
    const lines = content.split('\n');

    // Simple numeric operations on strings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for string concatenation with number
      if (/['"`]\s*\+\s*\d+/.test(line)) {
        mismatches.push({
          variable: 'expression',
          expected: 'string',
          found: 'string + number (possible coercion)',
          file,
          line: i + 1,
          confidence: 0.3,
        });
      }

      // Check for parseInt/parseFloat on non-string
      if (/parse(?:Int|Float)\((\w+)\)/.test(line)) {
        const varMatch = line.match(/parse(?:Int|Float)\((\w+)\)/);
        if (varMatch) {
          mismatches.push({
            variable: varMatch[1],
            expected: 'string',
            found: 'any',
            file,
            line: i + 1,
            confidence: 0.3,
          });
        }
      }
    }

    return mismatches;
  }

  generateDeclarations(inferredTypes: InferredType[]): TypeScriptDeclaration[] {
    const declarations: TypeScriptDeclaration[] = [];
    const byFile = new Map<string, InferredType[]>();

    for (const t of inferredTypes) {
      const list = byFile.get(t.file) || [];
      list.push(t);
      byFile.set(t.file, list);
    }

    for (const [file, types] of byFile.entries()) {
      const dtsFile = file.replace(/\.(js|jsx|ts|tsx)$/, '.d.ts');
      const uniqueTypes = new Map<string, { type: string; confidence: number }>();

      for (const t of types) {
        const existing = uniqueTypes.get(t.name);
        if (!existing || t.confidence > existing.confidence) {
          uniqueTypes.set(t.name, { type: t.type, confidence: t.confidence });
        }
      }

      const lines: string[] = [];
      lines.push(`// Auto-generated type declarations for ${file}`);
      lines.push('');

      for (const [name, info] of uniqueTypes.entries()) {
        lines.push(`declare const ${name}: ${info.type};`);
      }

      declarations.push({
        interface: lines.join('\n'),
        file: dtsFile,
      });
    }

    return declarations;
  }
}

export function printTypeInference(): void {
  const engine = new TypeInferenceEngine();
  const result = engine.infer();

  console.log(chalk.bold.blue('\n[shadow typeinference]\n'));

  const bySource: Record<string, number> = {};
  for (const t of result.inferredTypes) {
    bySource[t.source] = (bySource[t.source] || 0) + 1;
  }

  console.log(chalk.bold(`Inferred types: ${result.inferredTypes.length}`));
  for (const [source, count] of Object.entries(bySource).sort()) {
    console.log(`  ${chalk.cyan(source)}: ${count}`);
  }

  if (result.mismatches.length > 0) {
    console.log(chalk.bold.yellow(`\nType mismatches: ${result.mismatches.length}`));
    for (const m of result.mismatches.slice(0, 10)) {
      console.log(`  ${chalk.yellow('⚠')} ${m.variable}: expected ${m.expected}, found ${m.found} ${chalk.dim(`(${m.file}:${m.line})`)}`);
    }
  }

  console.log(chalk.bold(`\nGenerated declarations: ${result.declarations.length}`));

  if (result.inferredTypes.length > 0) {
    console.log(chalk.bold('\nTop inferred types:'));
    const top = result.inferredTypes
      .filter((t) => t.confidence > 0.7)
      .slice(0, 15);
    for (const t of top) {
      const confColor = t.confidence >= 0.9 ? chalk.green : chalk.yellow;
      console.log(`  ${confColor(t.type)} ${chalk.white(t.name)} ${chalk.dim(`(${t.source} - ${t.file}:${t.line})`)}`);
    }
  }
  console.log();
}
