import {
  ASTResult,
  ASTImport,
  ASTExport,
  ASTFunction,
  ASTClass,
  ASTVariable,
  ASTInterface,
  ASTTypeAlias,
  ASTCall,
  ASTHook,
  ASTStruct,
  ASTEnum,
  ASTTrait,
  ASTImpl,
  ASTRoute,
  ASTComment,
  ASTComplexity,
  ASTDeadCode,
  ASTRange,
} from './types';

function makeRange(line: number, colStart: number, colEnd: number): ASTRange {
  return {
    start: { line, column: colStart },
    end: { line, column: colEnd },
  };
}

function lineNum(code: string, index: number): number {
  return code.slice(0, index).split('\n').length;
}

function colNum(code: string, index: number): number {
  const lastNewline = code.lastIndexOf('\n', index);
  return lastNewline === -1 ? index + 1 : index - lastNewline;
}

function emptyResult(language: string, filePath: string): ASTResult {
  return {
    language,
    filePath,
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    variables: [],
    interfaces: [],
    types: [],
    calls: [],
    hooks: [],
    structs: [],
    enums: [],
    traits: [],
    impls: [],
    routes: [],
    comments: [],
    complexity: { cyclomaticComplexity: 0, linesOfCode: 0, nestingDepth: 0, functionLength: 0, parameterCount: 0 },
    deadCode: { unusedImports: [], unusedFunctions: [], unusedVariables: [], uncalledFunctions: [] },
    parseTime: 0,
  };
}

export function parsePythonRegex(code: string, filePath: string): ASTResult {
  const result = emptyResult('python', filePath);

  const importFromRegex = /from\s+([\w.]+)\s+import\s+([\w, *\s()]+)/g;
  let match: RegExpExecArray | null;
  while ((match = importFromRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.imports.push({
      name: match[2].trim(),
      source: match[1],
      type: 'named',
      range: makeRange(line, 1, match[0].length),
    });
  }

  const importRegex = /^import\s+(.+)$/gm;
  while ((match = importRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const names = match[1].split(',').map((n) => n.trim());
    for (const name of names) {
      const parts = name.split(/\s+as\s+/);
      result.imports.push({
        name: parts[0],
        source: parts[0],
        alias: parts[1] || undefined,
        type: 'named',
        range: makeRange(line, 1, match[0].length),
      });
    }
  }

  const funcRegex = /^\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*\s*(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/gm;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const decoratorBlock = match[0].match(/@[\w.]+(?:\([^)]*\))?/g) || [];
    const decorators = decoratorBlock.map((d) => d.slice(1).split('(')[0]);

    const funcBodyStart = match.index + match[0].length;
    const funcBodyEnd = findBlockEnd(code, funcBodyStart, 'def');

    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split('=')[0].split(':')[0].trim());

    result.functions.push({
      name: match[1],
      params,
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: !match[1].startsWith('_'),
      decorators,
      range: makeRange(line, 1, match[0].length),
      bodyStart: funcBodyStart,
      bodyEnd: funcBodyEnd,
    });
  }

  const classRegex = /^\s*(?:@[\w.]+(?:\([^)]*\))?\s*)*class\s+(\w+)(?:\(([^)]*)\))?\s*:/gm;
  while ((match = classRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const decorators = (match[0].match(/@[\w.]+(?:\([^)]*\))?/g) || []).map((d) => d.slice(1).split('(')[0]);
    const superClass = match[2]?.trim() || undefined;

    const classBodyStart = match.index + match[0].length;
    const classBodyEnd = findBlockEnd(code, classBodyStart, 'class');

    const methods: string[] = [];
    const classBody = code.slice(classBodyStart, classBodyEnd);
    const methodRegex = /\s*(?:async\s+)?def\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(classBody)) !== null) {
      methods.push(mMatch[1]);
    }

    result.classes.push({
      name: match[1],
      superClass,
      implements: [],
      exported: !match[1].startsWith('_'),
      decorators,
      methods,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const callRegex = /(\w+)\s*\(/g;
  while ((match = callRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    if (!isReservedWord(match[1])) {
      result.calls.push({
        name: match[1],
        callee: match[1],
        args: countArgs(code, match.index + match[0].length - 1),
        range: makeRange(line, match.index, match.index + match[0].length),
      });
    }
  }

  result.complexity = computeComplexity(code, result.functions);

  return result;
}

export function parseTypeScriptRegex(code: string, filePath: string): ASTResult {
  const result = emptyResult('typescript', filePath);

  const esImportRegex = /import\s+(?:(?:\{([^}]+)\}|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const named = match[1];
    const default_ = match[2];
    const source = match[5];

    if (default_) {
      result.imports.push({ name: default_, source, type: 'default', range: makeRange(line, 1, match[0].length) });
    }
    if (named) {
      const matchLen = match[0].length;
      named.split(',').forEach((n) => {
        const trimmed = n.trim().split(/\s+as\s+/);
        result.imports.push({
          name: trimmed[0].trim(),
          source,
          alias: trimmed[1]?.trim(),
          type: 'named',
          range: makeRange(line, 1, matchLen),
        });
      });
    }
    if (!default_ && !named) {
      result.imports.push({ name: source, source, type: 'namespace', range: makeRange(line, 1, match[0].length) });
    }
    const sideNamed = match[3];
    if (sideNamed) {
      const matchLen = match[0].length;
      sideNamed.split(',').forEach((n) => {
        result.imports.push({
          name: n.trim(),
          source,
          type: 'named',
          range: makeRange(line, 1, matchLen),
        });
      });
    }
  }

  const requireRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const named = match[1];
    const default_ = match[2];
    const source = match[3];
    if (default_) {
      result.imports.push({ name: default_, source, type: 'default', range: makeRange(line, 1, match[0].length) });
    }
    if (named) {
      const matchLen = match[0].length;
      named.split(',').forEach((n) => {
        result.imports.push({ name: n.trim(), source, type: 'named', range: makeRange(line, 1, matchLen) });
      });
    }
  }

  const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
  while ((match = exportRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.exports.push({ name: match[1], kind: match[0].includes('default') ? 'default' : 'named', range: makeRange(line, 1, match[0].length) });
  }

  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split('=')[0].split(':')[0].trim());

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);

    result.functions.push({
      name: match[1],
      params,
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: match[0].includes('export '),
      decorators: [],
      range: makeRange(line, 1, match[0].length),
      bodyStart,
      bodyEnd,
    });
  }

  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:async\s+)?(?:\(([^)]*)\)|[^=>]+)\s*=>/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const params = match[2]
      ? match[2].split(',').map((p) => p.trim()).filter(Boolean).map((p) => p.split('=')[0].split(':')[0].trim())
      : [];

    let bodyStart = match.index + match[0].length;
    let bodyEnd = code.length;
    if (code[bodyStart] === '{') {
      bodyEnd = findBraceEnd(code, bodyStart);
    }

    result.functions.push({
      name: match[1],
      params,
      returnType: undefined,
      async: match[0].includes('async '),
      exported: match[0].includes('export '),
      decorators: [],
      range: makeRange(line, 1, match[0].length),
      bodyStart,
      bodyEnd,
    });
  }

  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
  while ((match = classRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const implementsList = match[3]
      ? match[3].split(',').map((i) => i.trim())
      : [];

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\(/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      if (!isReservedWord(mMatch[1])) {
        methods.push(mMatch[1]);
      }
    }

    result.classes.push({
      name: match[1],
      superClass: match[2],
      implements: implementsList,
      exported: match[0].includes('export '),
      decorators: [],
      methods,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g;
  while ((match = interfaceRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const extendsList = match[2] ? match[2].split(',').map((i) => i.trim()) : [];
    result.interfaces.push({
      name: match[1],
      extends: extendsList,
      exported: match[0].includes('export '),
      range: makeRange(line, 1, match[0].length),
    });
  }

  const typeAliasRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*(.+?)(?:;|\n)/g;
  while ((match = typeAliasRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.types.push({
      name: match[1],
      type: match[2].trim(),
      exported: match[0].includes('export '),
      range: makeRange(line, 1, match[0].length),
    });
  }

  const varRegex = /(?:export\s+)?(const|let|var)\s+(\w+)\s*(?:=|:)/g;
  while ((match = varRegex.exec(code)) !== null) {
    if (!result.functions.some((f) => f.name === match![2])) {
      const line = lineNum(code, match.index);
      result.variables.push({
        name: match[2],
        kind: match[1] as 'const' | 'let' | 'var',
        exported: match[0].includes('export '),
        range: makeRange(line, 1, match[0].length),
      });
    }
  }

  const hookRegex = /(use[A-Z]\w+)\s*\(/g;
  while ((match = hookRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.hooks.push({
      name: match[1],
      callee: match[1],
      range: makeRange(line, match.index, match.index + match[0].length),
    });
  }

  const callRegex = /\.(\w+)\s*\(/g;
  while ((match = callRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    if (!isReservedWord(match[1])) {
      result.calls.push({
        name: match[1],
        callee: match[1],
        args: countArgs(code, match.index + match[0].length - 1),
        range: makeRange(line, match.index, match.index + match[0].length),
      });
    }
  }

  const standaloneCallRegex = /(?:\n|^)\s*(\w+)\s*\(/gm;
  while ((match = standaloneCallRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    if (!isReservedWord(match[1]) && !result.calls.some((c) => c.name === match![1])) {
      result.calls.push({
        name: match[1],
        callee: match[1],
        args: countArgs(code, match.index + match[0].length - 1),
        range: makeRange(line, match.index, match.index + match[0].length),
      });
    }
  }

  result.complexity = computeComplexity(code, result.functions);

  return result;
}

export function parseGoRegex(code: string, filePath: string): ASTResult {
  const result = emptyResult('go', filePath);

  let match: RegExpExecArray | null;

  const importBlockRegex = /import\s*\(([^)]+)\)/g;
  while ((match = importBlockRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const block = match[1];
    const quotedRegex = /"([^"]+)"/g;
    let qMatch: RegExpExecArray | null;
    while ((qMatch = quotedRegex.exec(block)) !== null) {
      const parts = qMatch[1].trim().split(/\s+/);
      const source = parts[parts.length - 1];
      const alias = parts.length > 1 ? parts[0] : undefined;
      result.imports.push({
        name: alias || source,
        source,
        alias,
        type: 'named',
        range: makeRange(line, 1, match[0].length),
      });
    }
  }

  const singleImportRegex = /import\s+(?:(\w+)\s+)?"([^"]+)"/g;
  while ((match = singleImportRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const alias = match[1];
    const source = match[2];
    result.imports.push({
      name: alias || source,
      source,
      alias,
      type: 'named',
      range: makeRange(line, 1, match[0].length),
    });
  }

  const funcRegex = /func\s+(?:\(\s*(?:\w+\s+)?(?:\*?\w+)\s*\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(([^)]*)\)|\s+([\w\[\]*.]+))?\s*\{/g;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(/\s+/).pop() || p);

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);

    const isExported = name[0] === name[0].toUpperCase() && name[0] !== '_';

    result.functions.push({
      name,
      params,
      returnType: match[3] || match[4] || undefined,
      async: false,
      exported: isExported,
      decorators: [],
      range: makeRange(line, 1, match[0].length),
      bodyStart,
      bodyEnd,
    });
  }

  const structRegex = /type\s+(\w+)\s+struct\s*\{([^}]*)\}/g;
  while ((match = structRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const isExported = name[0] === name[0].toUpperCase() && name[0] !== '_';
    const fieldsBody = match[2];
    const fields = fieldsBody
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//'))
      .map((l) => {
        const parts = l.split(/\s+/);
        return { name: parts[0], type: parts.slice(1).join(' ') || undefined, range: makeRange(line, 0, 0) };
      });

    result.structs.push({
      name,
      fields,
      exported: isExported,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const interfaceRegex = /type\s+(\w+)\s+interface\s*\{([^}]*)\}/g;
  while ((match = interfaceRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const body = match[2];
    const methods: string[] = [];
    const methodRegex = /(\w+)\s*\(/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    result.interfaces.push({
      name,
      extends: [],
      exported: name[0] === name[0].toUpperCase(),
      range: makeRange(line, 1, match[0].length),
    });
  }

  result.complexity = computeComplexity(code, result.functions);

  return result;
}

export function parseRustRegex(code: string, filePath: string): ASTResult {
  const result = emptyResult('rust', filePath);

  let match: RegExpExecArray | null;

  const useRegex = /use\s+([\w:]+)(?:::\{([^}]+)\})?(?:\s+as\s+(\w+))?;/g;
  while ((match = useRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const base = match[1];
    const items = match[2];
    const alias = match[3];

    if (items) {
      items.split(',').forEach((item) => {
        const trimmed = item.trim();
        if (trimmed) {
          result.imports.push({
            name: trimmed,
            source: `${base}::${trimmed}`,
            type: 'named',
            range: makeRange(line, 1, match![0].length),
          });
        }
      });
    } else {
      result.imports.push({
        name: alias || base,
        source: base,
        alias,
        type: 'named',
        range: makeRange(line, 1, match[0].length),
      });
    }
  }

  const fnRegex = /(?:pub(?:\s*\(\s*(?:crate|super)\s*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*->\s*([^{]+))?\s*(?:where\s+[^{]+)?\s*\{/g;
  while ((match = fnRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const params = match[2]
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => p.split(':')[0].trim());

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);

    result.functions.push({
      name: match[1],
      params,
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: match[0].includes('pub '),
      decorators: [],
      range: makeRange(line, 1, match[0].length),
      bodyStart,
      bodyEnd,
    });
  }

  const structRegex = /(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?\s*(?:\(([^)]*)\)|\s*\{([^}]*)\})/g;
  while ((match = structRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const isExported = match[0].includes('pub ');
    const tupleFields = match[2];
    const namedFields = match[3];
    let fields: { name: string; type?: string; range: ASTRange }[] = [];

    if (tupleFields) {
      fields = tupleFields.split(',').map((f, i) => ({
        name: `_${i}`,
        type: f.trim(),
        range: makeRange(line, 0, 0),
      }));
    } else if (namedFields) {
      fields = namedFields
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
        .map((f) => {
          const parts = f.split(':');
          return { name: parts[0].trim(), type: parts[1]?.trim(), range: makeRange(line, 0, 0) };
        });
    }

    result.structs.push({
      name,
      fields,
      exported: isExported,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const enumRegex = /(?:pub\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g;
  while ((match = enumRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const isExported = match[0].includes('pub ');
    const variants = match[2]
      .split(',')
      .map((v) => v.trim().split(/[({]/)[0].trim())
      .filter(Boolean);

    result.enums.push({
      name,
      variants,
      exported: isExported,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const traitRegex = /(?:pub\s+)?trait\s+(\w+)\s*(?::\s*([^{]+))?\s*\{/g;
  while ((match = traitRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const name = match[1];
    const isExported = match[0].includes('pub ');
    const traitExtends = match[2] ? match[2].split('+').map((t) => t.trim()) : [];

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /fn\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    result.traits.push({
      name,
      methods,
      exported: isExported,
      range: makeRange(line, 1, match[0].length),
    });

    result.interfaces.push({
      name,
      extends: traitExtends,
      exported: isExported,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const implRegex = /impl(?:\s*<[^>]+>)?\s+(?:(\w+)\s+for\s+)?(\w+)(?:<[^>]+>)?\s*(?:where\s+[^{]+)?\s*\{/g;
  while ((match = implRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    const trait = match[1];
    const type_ = match[2];

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /fn\s+(\w+)/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      methods.push(mMatch[1]);
    }

    result.impls.push({
      type: type_,
      trait,
      methods,
      range: makeRange(line, 1, match[0].length),
    });
  }

  const macroRegex = /(\w+)!\s*[({]/g;
  while ((match = macroRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.calls.push({
      name: `${match[1]}!`,
      callee: match[1],
      args: countArgs(code, match.index + match[0].length - 1),
      range: makeRange(line, match.index, match.index + match[0].length),
    });
  }

  result.complexity = computeComplexity(code, result.functions);

  return result;
}

export function parseShellRegex(code: string, filePath: string): ASTResult {
  const result = emptyResult('shell', filePath);
  const lines = code.split('\n');
  result.complexity.linesOfCode = lines.filter((l) => l.trim() && !l.trim().startsWith('#')).length;

  let match: RegExpExecArray | null;
  const funcRegex = /(?:^|\n)\s*(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/g;
  while ((match = funcRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.functions.push({
      name: match[1],
      params: [],
      returnType: undefined,
      async: false,
      exported: false,
      decorators: [],
      range: makeRange(line, 1, match[0].length),
      bodyStart: match.index + match[0].length,
      bodyEnd: findBraceEnd(code, match.index + match[0].length - 1),
    });
  }

  const sourceRegex = /^(?:source|\.)\s+(.+)/gm;
  while ((match = sourceRegex.exec(code)) !== null) {
    const line = lineNum(code, match.index);
    result.imports.push({
      name: match[1].trim(),
      source: match[1].trim(),
      type: 'named',
      range: makeRange(line, 1, match[0].length),
    });
  }

  return result;
}

export function parseFallback(code: string, language: string, filePath: string): ASTResult {
  switch (language) {
    case 'python':
      return parsePythonRegex(code, filePath);
    case 'typescript':
    case 'javascript':
      return parseTypeScriptRegex(code, filePath);
    case 'go':
      return parseGoRegex(code, filePath);
    case 'rust':
      return parseRustRegex(code, filePath);
    case 'shell':
      return parseShellRegex(code, filePath);
    default:
      return parseTypeScriptRegex(code, filePath);
  }
}

function findBlockEnd(code: string, start: number, _keyword: string): number {
  const rest = code.slice(start);
  const lines = rest.split('\n');
  let end = start;

  let baseIndent: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0) continue;

    const trimmed = line.trim();
    if (!trimmed) continue;

    if (baseIndent === null) {
      baseIndent = line.search(/\S/);
      if (baseIndent === 0) {
        return start + lines.slice(0, i).join('\n').length;
      }
    }

    const indent = line.search(/\S/);
    if (indent >= 0 && indent < (baseIndent || 1)) {
      return start + lines.slice(0, i).join('\n').length;
    }

    end = start + lines.slice(0, i + 1).join('\n').length;
  }

  return end || start + rest.length;
}

function findBraceEnd(code: string, openBraceIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let inComment = false;

  for (let i = openBraceIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];

    if (inComment) {
      if (ch === '\n') inComment = false;
      continue;
    }

    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }

    if (ch === '/' && code[i + 1] === '/') {
      inComment = true;
      i++;
      continue;
    }
    if (ch === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2);
      if (end !== -1) {
        i = end + 1;
        continue;
      }
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return code.length;
}

function countArgs(code: string, openParenIndex: number): number {
  let depth = 0;
  let start = -1;

  for (let i = openParenIndex; i < openParenIndex + 1; i++) {
    if (code[i] === '(') {
      depth++;
      if (start === -1) start = i;
    }
  }

  if (start === -1) return 0;

  const end = findMatchingParen(code, start);
  const args = code.slice(start + 1, end).trim();
  if (!args) return 0;
  return args.split(',').filter((a) => a.trim()).length;
}

function findMatchingParen(code: string, openIndex: number): number {
  let depth = 0;
  let inString: string | null = null;

  for (let i = openIndex; i < code.length; i++) {
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

    if (ch === '(') depth++;
    if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return openIndex;
}

function isReservedWord(word: string): boolean {
  const reserved = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'return', 'throw', 'try', 'catch', 'finally', 'new',
    'delete', 'typeof', 'instanceof', 'in', 'of', 'class', 'function',
    'var', 'let', 'const', 'import', 'export', 'from', 'as', 'async',
    'await', 'yield', 'static', 'extends', 'super', 'this', 'void',
    'with', 'debugger', 'true', 'false', 'null', 'undefined', 'enum',
    'type', 'interface', 'implements', 'package', 'private', 'protected',
    'public', 'abstract', 'final', 'def', 'pass', 'raise', 'except',
    'match', 'and', 'or', 'not', 'is', 'lambda', 'global', 'nonlocal',
    'elif', 'go', 'chan', 'select', 'range', 'defer', 'fallthrough',
  ]);
  return reserved.has(word);
}

function computeComplexity(code: string, functions: ASTFunction[]): ASTComplexity {
  const branchingPatterns = [
    /\bif\b/g, /\belif\b/g, /\belse\b/g,
    /\bfor\b/g, /\bwhile\b/g, /\bcase\b/g,
    /\bcatch\b/g, /\b\?\s*:/g, /\b&&\b/g, /\b\|\|\b/g,
    /\bmatch\b/g, /\bexcept\b/g, /\bwhen\b/g,
  ];

  let totalBranching = 0;
  for (const pattern of branchingPatterns) {
    const matches = code.match(pattern);
    if (matches) totalBranching += matches.length;
  }

  const lines = code.split('\n');
  const nonEmptyLines = lines.filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
  const codeLines = lines.filter((l) => l.trim());

  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of codeLines) {
    const trimmed = line.trim();
    if (/^[\}\]]/.test(trimmed)) {
      currentNesting = Math.max(0, currentNesting - 1);
    }
    if (/\{$/.test(trimmed) || /:$/.test(trimmed)) {
      currentNesting++;
      maxNesting = Math.max(maxNesting, currentNesting);
    }
  }

  const longestFunc = functions.reduce(
    (max, f) => {
      const length = f.bodyEnd - f.bodyStart;
      return length > max.length ? { length, params: f.params.length } : max;
    },
    { length: 0, params: 0 },
  );

  // Rough function length in lines
  let funcLines = 0;
  if (functions.length > 0 && functions[0].bodyStart > 0) {
    const body = code.slice(functions[0].bodyStart, functions[0].bodyEnd);
    funcLines = body.split('\n').filter((l) => l.trim()).length;
  }

  return {
    cyclomaticComplexity: totalBranching + 1,
    linesOfCode: nonEmptyLines.length,
    nestingDepth: maxNesting,
    functionLength: funcLines || Math.floor(codeLines.length / Math.max(1, functions.length)),
    parameterCount: longestFunc.params,
  };
}
