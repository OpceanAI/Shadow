import {
  ASTResult, ASTImport, ASTFunction, ASTClass, ASTStruct,
  ASTInterface, ASTCall, ASTRoute, ASTField,
} from './types';
import { parseGoRegex } from './regex-fallback';

export interface GoParseResult extends ASTResult {
  packageName: string;
  goroutines: string[];
  channels: string[];
}

export function parseGo(code: string, filePath: string): GoParseResult {
  const base = parseGoRegex(code, filePath);

  const packageMatch = code.match(/^package\s+(\w+)/m);
  const packageName = packageMatch ? packageMatch[1] : 'main';

  const goroutines = extractGoroutines(code);
  const channels = extractChannels(code);

  return {
    ...base,
    packageName,
    goroutines,
    channels,
  };
}

function extractGoroutines(code: string): string[] {
  const goroutines: string[] = [];

  const goRegex = /\bgo\s+(?:func\s*\([^)]*\)|(\w+)\s*\()/g;
  let match: RegExpExecArray | null;
  while ((match = goRegex.exec(code)) !== null) {
    goroutines.push(match[1] || 'anonymous');
  }

  return goroutines;
}

function extractChannels(code: string): string[] {
  const channels: string[] = [];

  const makeRegex = /make\s*\(\s*chan\s+(?:<-)?\s*(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = makeRegex.exec(code)) !== null) {
    channels.push(match[1]);
  }

  const chanDeclRegex = /\b(?:chan\s+(\w+)|\w+\s+chan\b)/g;
  while ((match = chanDeclRegex.exec(code)) !== null) {
    if (match[1] && !channels.includes(match[1])) {
      channels.push(match[1]);
    }
  }

  const arrowRegex = /<-\s*(\w+)/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    if (match[1] !== 'range' && !channels.includes(match[1])) {
      channels.push(match[1]);
    }
  }

  return channels;
}

export function extractGoImports(code: string): ASTImport[] {
  const imports: ASTImport[] = [];

  const importBlockRegex = /import\s*\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = importBlockRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const block = match[1];
    const quotedRegex = /"([^"]+)"/g;
    let qMatch: RegExpExecArray | null;
    while ((qMatch = quotedRegex.exec(block)) !== null) {
      const parts = qMatch[1].trim().split(/\s+/);
      const source = parts[parts.length - 1];
      const alias = parts.length > 1 ? parts[0] : undefined;
      imports.push({
        name: alias || source,
        source,
        alias,
        type: 'named',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  const singleImportRegex = /import\s+(?:(\w+)\s+)?"([^"]+)"/g;
  while ((match = singleImportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const alias = match[1];
    const source = match[2];
    if (!imports.some((i) => i.source === source)) {
      imports.push({
        name: alias || source,
        source,
        alias,
        type: 'named',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  return imports;
}

export function extractGoFunctions(code: string): ASTFunction[] {
  const functions: ASTFunction[] = [];

  const funcRegex = /func\s+(?:\(\s*(?:\w+\s+)?(?:\*?\w+)\s*\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\)|\s+([\w\[\]*.]+))?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/\s+/).pop() || p);

    const isExported = name[0] === name[0].toUpperCase() && name[0] !== '_' && name !== 'init';

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);

    functions.push({
      name,
      params,
      returnType: match[3] || match[4] || undefined,
      async: false,
      exported: isExported,
      decorators: [],
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      bodyStart,
      bodyEnd,
    });
  }

  return functions;
}

export function extractGoStructs(code: string): ASTStruct[] {
  const structs: ASTStruct[] = [];

  const structRegex = /type\s+(\w+)\s+struct\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = structRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const isExported = name[0] === name[0].toUpperCase() && name[0] !== '_';

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const fields: ASTField[] = [];
    const fieldLines = body.split('\n');
    for (const fl of fieldLines) {
      const trimmed = fl.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      const tagMatch = trimmed.match(/`([^`]*)`/);
      const parts = trimmed.replace(/`[^`]*`/, '').trim().split(/\s+/);

      if (parts.length >= 2) {
        fields.push({
          name: parts[0],
          type: parts.slice(1).join(' '),
          range: { start: { line, column: 0 }, end: { line, column: 0 } },
        });
      } else if (parts.length === 1) {
        fields.push({
          name: parts[0],
          type: undefined,
          range: { start: { line, column: 0 }, end: { line, column: 0 } },
        });
      }
    }

    structs.push({
      name,
      fields,
      exported: isExported,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return structs;
}

export function extractGoInterfaces(code: string): ASTInterface[] {
  const interfaces: ASTInterface[] = [];

  const interfaceRegex = /type\s+(\w+)\s+interface\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = interfaceRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const body = match[2];

    const methods: string[] = [];
    const methodRegex = /(\w+)\s*\(/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    interfaces.push({
      name,
      extends: [],
      exported: name[0] === name[0].toUpperCase(),
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return interfaces;
}

export function extractGoRoutes(code: string, filePath: string): ASTRoute[] {
  const routes: ASTRoute[] = [];

  const ginMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'Any'];
  for (const method of ginMethods) {
    const regex = new RegExp(`r\\.${method}\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[1],
        method: method === 'Any' ? 'ANY' : method,
        handler: 'handler',
        framework: 'gin',
        file: filePath,
        line,
      });
    }
  }

  const echoRegex = /e\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any|Match)\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = echoRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    routes.push({
      path: match[2],
      method: match[1] === 'Any' || match[1] === 'Match' ? match[1].toUpperCase() : match[1],
      handler: 'handler',
      framework: 'echo',
      file: filePath,
      line,
    });
  }

  const fiberRegex = /app\.(Get|Post|Put|Delete|Patch|Head|Options|All|Use)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = fiberRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    routes.push({
      path: match[2],
      method: match[1].toUpperCase(),
      handler: 'handler',
      framework: 'fiber',
      file: filePath,
      line,
    });
  }

  const netHttpRegex = /http\.HandleFunc\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g;
  while ((match = netHttpRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    routes.push({
      path: match[1],
      method: 'ANY',
      handler: match[2],
      framework: 'net/http',
      file: filePath,
      line,
    });
  }

  return routes;
}

export function extractGoCalls(code: string): ASTCall[] {
  const calls: ASTCall[] = [];

  const callRegex = /\.(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(code)) !== null) {
    if (isReservedWord(match[1])) continue;
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

function findBraceEnd(code: string, openBraceIndex: number): number {
  let depth = 0;
  let inString: string | null = null;

  for (let i = openBraceIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];

    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      if (nl !== -1) { i = nl; continue; }
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end !== -1) { i = end + 1; continue; }
    }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return i + 1; }
  }

  return code.length;
}

function countParenArgs(code: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let end = openIndex;

  for (let i = openIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];
    if (inString) { if (ch === inString && prev !== '\\') inString = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }

  const args = code.slice(openIndex + 1, end).trim();
  if (!args) return 0;
  return args.split(',').filter((a) => a.trim()).length;
}

function isReservedWord(word: string): boolean {
  const reserved = new Set([
    'if', 'else', 'for', 'range', 'switch', 'case', 'select',
    'break', 'continue', 'return', 'go', 'defer', 'fallthrough',
    'func', 'var', 'const', 'type', 'struct', 'interface', 'map',
    'chan', 'package', 'import', 'true', 'false', 'nil',
  ]);
  return reserved.has(word);
}
