import { ASTResult, ASTImport, ASTFunction, ASTClass, ASTRoute, ASTCall } from './types';
import { parsePythonRegex } from './regex-fallback';

export interface PythonParseResult extends ASTResult {
  decorators: Map<string, string[]>;
  typeHints: Map<string, string>;
  docstrings: Map<string, string>;
}

export function parsePython(code: string, filePath: string): PythonParseResult {
  const base = parsePythonRegex(code, filePath);

  const decorators = new Map<string, string[]>();
  const typeHints = new Map<string, string>();
  const docstrings = new Map<string, string>();

  const funcDefRegex = /^\s*(?:async\s+)?def\s+(\w+)/gm;
  let match: RegExpExecArray | null;

  while ((match = funcDefRegex.exec(code)) !== null) {
    const funcName = match[1];

    const lines = code.slice(0, match.index).split('\n');
    const funcLine = lines.length - 1;

    const decors: string[] = [];
    for (let i = lines.length - 2; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('@')) {
        decors.unshift(trimmed.slice(1).split('(')[0]);
      } else if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      } else {
        break;
      }
    }
    if (decors.length > 0) {
      decorators.set(funcName, decors);
    }
  }

  const typeHintRegex = /\b(\w+)\s*:\s*(\w+(?:\[[^\]]+\])?)\s*(?:=|$)/g;
  while ((match = typeHintRegex.exec(code)) !== null) {
    typeHints.set(match[1], match[2]);
  }

  const returnTypeRegex = /->\s*(\w+(?:\[[^\]]+\])?)\s*:/g;
  let rtMatch: RegExpExecArray | null;
  while ((rtMatch = returnTypeRegex.exec(code)) !== null) {
    const preMatch = code.slice(0, rtMatch.index).match(/def\s+(\w+)/);
    if (preMatch) {
      typeHints.set(`${preMatch[1]}_return`, rtMatch[1]);
    }
  }

  const docstringRegex = /def\s+(\w+).*:\s*\n\s*(?:"""(.*?)"""|'''(.*?)''')/gs;
  let dsMatch: RegExpExecArray | null;
  while ((dsMatch = docstringRegex.exec(code)) !== null) {
    const name = dsMatch[1];
    const content = (dsMatch[2] || dsMatch[3] || '').trim();
    if (content) {
      docstrings.set(name, content.split('\n')[0].trim());
    }
  }

  return {
    ...base,
    decorators,
    typeHints,
    docstrings,
  };
}

export function extractPythonImports(code: string): ASTImport[] {
  const imports: ASTImport[] = [];
  const seen = new Set<string>();

  const fromRegex = /from\s+([\w.]+)\s+import\s+([\w, *\s()]+)/g;
  let match: RegExpExecArray | null;
  while ((match = fromRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const source = match[1];
    const items = match[2].split(',').map((i) => {
      const parts = i.trim().split(/\s+as\s+/);
      return { name: parts[0].trim(), alias: parts[1]?.trim() };
    });

    for (const item of items) {
      const key = `${source}.${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      imports.push({
        name: item.alias || item.name,
        source,
        alias: item.alias,
        type: 'named',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  const simpleImportRegex = /^import\s+(.+)$/gm;
  while ((match = simpleImportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const names = match[1].split(',').map((n) => n.trim());
    for (const name of names) {
      const parts = name.split(/\s+as\s+/);
      const key = parts[0];
      if (seen.has(key)) continue;
      seen.add(key);
      imports.push({
        name: parts[1] || parts[0],
        source: parts[0],
        alias: parts[1],
        type: 'named',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  return imports;
}

export function extractPythonFunctions(code: string): ASTFunction[] {
  const functions: ASTFunction[] = [];

  const funcRegex = /^\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const decorators = (match[0].match(/@[\w.]+(?:\([^)]*\))?/g) || [])
      .map((d) => d.slice(1).split('(')[0]);

    const bodyStart = match.index + match[0].length;

    functions.push({
      name: match[1],
      params: match[2].split(',').map((p) => p.trim().split(':')[0].split('=')[0].trim()).filter(Boolean),
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: !match[1].startsWith('_'),
      decorators,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      bodyStart,
      bodyEnd: code.length,
    });
  }

  return functions;
}

export function extractPythonClasses(code: string): ASTClass[] {
  const classes: ASTClass[] = [];

  const classRegex = /^\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const decorators = (match[0].match(/@[\w.]+(?:\([^)]*\))?/g) || [])
      .map((d) => d.slice(1).split('(')[0]);
    const superClass = match[2]?.trim();

    const classBodyStart = match.index + match[0].length;
    const classBody = code.slice(classBodyStart);
    const classBodyLines = classBody.split('\n');

    let bodyEndIdx = classBody.length;
    let baseIndent: number | null = null;
    for (let i = 1; i < classBodyLines.length; i++) {
      const trimmed = classBodyLines[i].trim();
      if (!trimmed) continue;
      const indent = classBodyLines[i].search(/\S/);
      if (baseIndent === null) {
        baseIndent = indent;
        if (baseIndent === 0) {
          bodyEndIdx = classBodyLines.slice(0, i).join('\n').length + classBodyStart;
          break;
        }
      } else if (indent < baseIndent) {
        bodyEndIdx = classBodyLines.slice(0, i).join('\n').length + classBodyStart;
        break;
      }
    }

    const actualBody = code.slice(classBodyStart, bodyEndIdx);
    const methods: string[] = [];
    const methodRegex = /\s*(?:async\s+)?def\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(actualBody)) !== null) {
      methods.push(mMatch[1]);
    }

    classes.push({
      name: match[1],
      superClass,
      implements: [],
      exported: !match[1].startsWith('_'),
      decorators,
      methods,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return classes;
}

export function extractPythonRoutes(code: string, filePath: string): ASTRoute[] {
  const routes: ASTRoute[] = [];

  const flaskRouteRegex = /@((?:[\w.]+)?app)\.route\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = flaskRouteRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const rest = code.slice(match.index);
    const methodMatch = rest.match(/methods\s*=\s*\[([^\]]+)\]/);
    const methods = methodMatch
      ? methodMatch[1].split(',').map((m) => m.trim().replace(/['"]/g, '').toUpperCase())
      : ['GET'];

    const nextLine = rest.split('\n')[1] || '';
    const fnMatch = nextLine.match(/def\s+(\w+)/);
    const handler = fnMatch ? fnMatch[1] : 'unknown';

    for (const method of methods) {
      routes.push({ path: match[2], method, handler, framework: 'flask', file: filePath, line });
    }
  }

  const fastapiRouteRegex = /@((?:[\w.]+)?app)\.(get|post|put|delete|patch|head|options)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = fastapiRouteRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const nextLine = code.slice(match.index + match[0].length).trim().split('\n')[0] || '';
    const fnMatch = nextLine.match(/(?:async\s+)?def\s+(\w+)/);
    const handler = fnMatch ? fnMatch[1] : 'unknown';

    routes.push({
      path: match[3],
      method: match[2].toUpperCase(),
      handler,
      framework: 'fastapi',
      file: filePath,
      line,
    });
  }

  const fastapiRouterRegex = /@((?:[\w.]+)?router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = fastapiRouterRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const nextLine = code.slice(match.index + match[0].length).trim().split('\n')[0] || '';
    const fnMatch = nextLine.match(/(?:async\s+)?def\s+(\w+)/);
    const handler = fnMatch ? fnMatch[1] : 'unknown';

    routes.push({
      path: match[3],
      method: match[2].toUpperCase(),
      handler,
      framework: 'fastapi',
      file: filePath,
      line,
    });
  }

  return routes;
}

export function extractPythonCalls(code: string): ASTCall[] {
  const calls: ASTCall[] = [];
  const callRegex = /(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  const reserved = new Set([
    'if', 'else', 'for', 'while', 'def', 'class', 'return', 'import',
    'from', 'raise', 'try', 'except', 'with', 'async', 'await', 'print',
    'len', 'range', 'int', 'str', 'float', 'bool', 'list', 'dict', 'set',
    'tuple', 'type', 'isinstance', 'super', 'hasattr', 'getattr', 'is',
    'not', 'and', 'or', 'in', 'assert', 'pass', 'yield', 'lambda',
  ]);

  while ((match = callRegex.exec(code)) !== null) {
    if (reserved.has(match[1])) continue;
    const line = code.slice(0, match.index).split('\n').length;
    calls.push({
      name: match[1],
      callee: match[1],
      args: countParenArgs(code, match.index + match[0].length - 1),
      range: { start: { line, column: match.index }, end: { line, column: match.index + match[0].length } },
    });
  }

  return calls;
}

function countParenArgs(code: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let end = openIndex;

  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }

  const args = code.slice(openIndex + 1, end).trim();
  if (!args) return 0;
  return args.split(',').filter((a) => a.trim()).length;
}
