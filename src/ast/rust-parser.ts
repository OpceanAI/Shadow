import {
  ASTResult, ASTImport, ASTFunction, ASTStruct, ASTEnum,
  ASTTrait, ASTImpl, ASTCall, ASTRoute,
} from './types';
import { parseRustRegex } from './regex-fallback';

export interface RustParseResult extends ASTResult {
  unsafeBlocks: number;
  macros: string[];
  lifetimes: string[];
}

export function parseRust(code: string, filePath: string): RustParseResult {
  const base = parseRustRegex(code, filePath);

  const unsafeBlocks = countUnsafeBlocks(code);
  const macros = extractMacros(code);
  const lifetimes = extractLifetimes(code);

  return {
    ...base,
    unsafeBlocks,
    macros,
    lifetimes,
  };
}

function countUnsafeBlocks(code: string): number {
  const unsafeRegex = /\bunsafe\s*\{/g;
  const matches = code.match(unsafeRegex);
  return matches ? matches.length : 0;
}

function extractMacros(code: string): string[] {
  const macros: string[] = [];
  const seen = new Set<string>();

  const macroRegex = /(\w+)!\s*[({]/g;
  let match: RegExpExecArray | null;
  while ((match = macroRegex.exec(code)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      macros.push(name);
    }
  }

  const declRegex = /macro_rules!\s+(\w+)/g;
  while ((match = declRegex.exec(code)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      macros.push(match[1]);
    }
  }

  return macros;
}

function extractLifetimes(code: string): string[] {
  const lifetimes: string[] = [];
  const seen = new Set<string>();

  const lifetimeRegex = /'(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = lifetimeRegex.exec(code)) !== null) {
    const name = match[1];
    if (!['static', 'a', 'b', 'c'].includes(name)) {
      if (!seen.has(name)) {
        seen.add(name);
        lifetimes.push(name);
      }
    }
  }

  return lifetimes;
}

export function extractRustImports(code: string): ASTImport[] {
  const imports: ASTImport[] = [];

  const useRegex = /use\s+([\w:]+)(?:::\{([^}]+)\})?(?:\s+as\s+(\w+))?;/g;
  let match: RegExpExecArray | null;
  while ((match = useRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const base = match[1];
    const items = match[2];
    const alias = match[3];

    if (items) {
      items.split(',').forEach((item) => {
        const trimmed = item.trim();
        if (trimmed) {
          imports.push({
            name: trimmed,
            source: `${base}::${trimmed}`,
            type: 'named',
            range: { start: { line, column: 1 }, end: { line, column: match![0].length } },
          });
        }
      });
    } else {
      imports.push({
        name: alias || base,
        source: base,
        alias,
        type: 'named',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  const externRegex = /extern\s+crate\s+(\w+)/g;
  while ((match = externRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    imports.push({
      name: match[1],
      source: match[1],
      type: 'named',
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return imports;
}

export function extractRustFunctions(code: string): ASTFunction[] {
  const functions: ASTFunction[] = [];

  const fnRegex = /(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+(?:"[^"]+"|'[^']+')\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*(?:where\s+[^{]+)?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = fnRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const selfMatch = p.match(/^(?:&(?:mut\s+)?)?self/);
        if (selfMatch) return 'self';
        const parts = p.split(':')[0].trim().split(/\s+/);
        return parts[parts.length - 1] || p;
      });

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);

    functions.push({
      name: match[1],
      params,
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: match[0].includes('pub '),
      decorators: [],
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      bodyStart,
      bodyEnd,
    });
  }

  return functions;
}

export function extractRustStructs(code: string): ASTStruct[] {
  const structs: ASTStruct[] = [];

  const structRegex = /(?:#\[[^\]]*\]\s*)*(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?\s*(?:\(([^)]*)\)|\s*\{([^}]*)\})/g;
  let match: RegExpExecArray | null;
  while ((match = structRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const isExported = match[0].includes('pub ');
    const tupleFields = match[2];
    const namedFields = match[3];

    const fields: { name: string; type?: string; range: { start: { line: number; column: number }; end: { line: number; column: number } } }[] = [];
    if (tupleFields) {
      tupleFields.split(',').forEach((f, i) => {
        if (f.trim()) {
          fields.push({
            name: `_${i}`,
            type: f.trim(),
            range: { start: { line, column: 0 }, end: { line, column: 0 } },
          });
        }
      });
    } else if (namedFields) {
      namedFields.split(',').forEach((f) => {
        const trimmed = f.trim();
        if (trimmed && !trimmed.startsWith('//')) {
          const parts = trimmed.split(':');
          fields.push({
            name: parts[0].trim(),
            type: parts[1]?.trim(),
            range: { start: { line, column: 0 }, end: { line, column: 0 } },
          });
        }
      });
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

export function extractRustEnums(code: string): ASTEnum[] {
  const enums: ASTEnum[] = [];

  const enumRegex = /(?:#\[[^\]]*\]\s*)*(?:pub\s+)?enum\s+(\w+)(?:<[^>]+>)?\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const isExported = match[0].includes('pub ');
    const variants = match[2]
      .split(',')
      .map((v) => v.trim().split(/[({]/)[0].trim())
      .filter(Boolean);

    enums.push({
      name,
      variants,
      exported: isExported,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return enums;
}

export function extractRustTraits(code: string): ASTTrait[] {
  const traits: ASTTrait[] = [];

  const traitRegex = /(?:pub\s+)?(?:unsafe\s+)?trait\s+(\w+)(?:<[^>]+>)?\s*(?::\s*([^{]+))?\s*(?:where\s+[^{]+)?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = traitRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const name = match[1];
    const isExported = match[0].includes('pub ');

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /(?:async\s+)?fn\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    traits.push({
      name,
      methods,
      exported: isExported,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return traits;
}

export function extractRustImpls(code: string): ASTImpl[] {
  const impls: ASTImpl[] = [];

  const implRegex = /impl(?:\s*<[^>]+>)?\s+(?:(\w+)\s+for\s+)?(\w+)(?:<[^>]+>)?\s*(?:where\s+[^{]+)?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = implRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const trait = match[1];
    const type_ = match[2];

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /(?:pub\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    impls.push({
      type: type_,
      trait,
      methods,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return impls;
}

export function extractRustRoutes(code: string, filePath: string): ASTRoute[] {
  const routes: ASTRoute[] = [];

  const actixRegex = /#\[(get|post|put|delete|patch|head|options)\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = actixRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;

    const rest = code.slice(match.index + match[0].length);
    const fnMatch = rest.trim().match(/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/);
    const handler = fnMatch ? fnMatch[1] : 'unknown';

    routes.push({
      path: match[2],
      method: match[1].toUpperCase(),
      handler,
      framework: 'actix',
      file: filePath,
      line,
    });
  }

  const rocketRegex = /#\[(get|post|put|delete|patch|head|options)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = rocketRegex.exec(code)) !== null) {
    if (code.includes('rocket')) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[2],
        method: match[1].toUpperCase(),
        handler: 'handler',
        framework: 'rocket',
        file: filePath,
        line,
      });
    }
  }

  const axumRegex = /(?:get|post|put|delete|patch|head|options)\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\w+)/g;
  while ((match = axumRegex.exec(code)) !== null) {
    if (code.includes('axum') || code.includes('Router')) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[1],
        method: match[0].match(/^(\w+)/)?.[1]?.toUpperCase() || 'GET',
        handler: match[2],
        framework: 'axum',
        file: filePath,
        line,
      });
    }
  }

  return routes;
}

export function extractRustCalls(code: string): ASTCall[] {
  const calls: ASTCall[] = [];

  const callRegex = /\.(\w+)\s*(?:::[^<]*)?\s*\(/g;
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

  const macroRegex = /(\w+)!\s*[({]/g;
  while ((match = macroRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    calls.push({
      name: `${match[1]}!`,
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
    if (ch === '"' || ch === "'") { inString = ch; continue; }

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
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }

  const args = code.slice(openIndex + 1, end).trim();
  if (!args) return 0;
  return args.split(',').filter((a) => a.trim()).length;
}

function isReservedWord(word: string): boolean {
  const reserved = new Set([
    'if', 'else', 'for', 'while', 'loop', 'match', 'if', 'let',
    'break', 'continue', 'return', 'move', 'async', 'await', 'dyn',
    'fn', 'pub', 'crate', 'self', 'super', 'mod', 'use', 'extern',
    'const', 'static', 'mut', 'ref', 'where', 'unsafe', 'impl',
    'trait', 'enum', 'struct', 'type', 'macro',
  ]);
  return reserved.has(word);
}
