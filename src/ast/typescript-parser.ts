import {
  ASTResult, ASTImport, ASTExport, ASTFunction, ASTClass,
  ASTInterface, ASTTypeAlias, ASTVariable, ASTHook, ASTRoute, ASTCall,
} from './types';
import { parseTypeScriptRegex } from './regex-fallback';

export interface TypeScriptParseResult extends ASTResult {
  jsxComponents: string[];
  hooks: ASTHook[];
  middlewarePatterns: string[];
}

export function parseTypeScript(code: string, filePath: string): TypeScriptParseResult {
  const base = parseTypeScriptRegex(code, filePath);

  const jsxComponents = extractJSXComponentsInternal(code);
  const middlewarePatterns = extractMiddlewarePatterns(code);
  const hooks = extractHooks(code);

  return {
    ...base,
    jsxComponents,
    hooks: [...base.hooks, ...hooks.filter((h) => !base.hooks.some((bh) => bh.name === h.name))],
    middlewarePatterns,
  };
}

function extractJSXComponentsInternal(code: string): string[] {
  const components: string[] = [];
  const seen = new Set<string>();

  const componentRegex = /(?:function|const|class)\s+([A-Z]\w*)/g;
  let match: RegExpExecArray | null;
  while ((match = componentRegex.exec(code)) !== null) {
    if (!seen.has(match[1])) {
      components.push(match[1]);
      seen.add(match[1]);
    }
  }

  const jsxReturnRegex = /\breturn\s*[\(\s]*</g;
  if (jsxReturnRegex.test(code)) {
    const arrowComponents = /(?:const|let|var)\s+([A-Z]\w*)\s*=/g;
    while ((match = arrowComponents.exec(code)) !== null) {
      if (!seen.has(match[1])) {
        components.push(match[1]);
        seen.add(match[1]);
      }
    }
  }

  return components;
}

export function extractJSXComponents(code: string): string[] {
  return extractJSXComponentsInternal(code);
}

export function extractHooks(code: string): ASTHook[] {
  const hooks: ASTHook[] = [];
  const seen = new Set<string>();

  const hookPatterns = [
    'useState', 'useEffect', 'useContext', 'useReducer', 'useCallback',
    'useMemo', 'useRef', 'useImperativeHandle', 'useLayoutEffect',
    'useDebugValue', 'useTransition', 'useDeferredValue', 'useId',
    'useNavigate', 'useParams', 'useLocation', 'useSearchParams',
    'useLoaderData', 'useActionData', 'useRouteError', 'useFetcher',
    'useQuery', 'useMutation', 'useSubscription',
  ];

  const hookRegex = /(use[A-Z]\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = hookRegex.exec(code)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      const line = code.slice(0, match.index).split('\n').length;
      hooks.push({
        name,
        callee: name,
        range: { start: { line, column: match.index }, end: { line, column: match.index + match[0].length } },
      });
    }
  }

  return hooks;
}

function extractMiddlewarePatterns(code: string): string[] {
  const patterns: string[] = [];

  const middlewareFuncRegex = /(?:async\s+)?function\s+(\w*(?:middleware|auth|guard|handler|interceptor)\w*)/gi;
  let match: RegExpExecArray | null;
  while ((match = middlewareFuncRegex.exec(code)) !== null) {
    patterns.push(`middleware function: ${match[1]}`);
  }

  const appUseRegex = /app\.use\s*\(\s*(\w+)/g;
  while ((match = appUseRegex.exec(code)) !== null) {
    patterns.push(`app.use: ${match[1]}`);
  }

  const routerUseRegex = /router\.use\s*\(\s*(\w+)/g;
  while ((match = routerUseRegex.exec(code)) !== null) {
    patterns.push(`router.use: ${match[1]}`);
  }

  const nestGuardRegex = /@UseGuards\s*\(\s*(\w+)/g;
  while ((match = nestGuardRegex.exec(code)) !== null) {
    patterns.push(`NestJS guard: ${match[1]}`);
  }

  const nestInterceptorRegex = /@UseInterceptors\s*\(\s*(\w+)/g;
  while ((match = nestInterceptorRegex.exec(code)) !== null) {
    patterns.push(`NestJS interceptor: ${match[1]}`);
  }

  const nextMiddlewareRegex = /(?:app|router)\.\w+\s*\(\s*['"](\/[^'"]+)['"]\s*,\s*(?:async\s*)?\(/g;
  while ((match = nextMiddlewareRegex.exec(code)) !== null) {
    patterns.push(`Next.js route: ${match[1]}`);
  }

  return patterns;
}

export function extractTypeScriptImports(code: string): ASTImport[] {
  const imports: ASTImport[] = [];

  const esImportRegex = /import\s+(?:(?:\{([^}]+)\}|(\w+)(?:\s*,\s*\{([^}]+)\})?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = esImportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const named = match[1];
    const default_ = match[2];
    const sideNamed = match[3];
    const source = match[4];

    if (default_) {
      imports.push({ name: default_, source, type: 'default', range: { start: { line, column: 1 }, end: { line, column: match[0].length } } });
    }
    if (named) {
      const matchLen = match[0].length;
      named.split(',').forEach((n) => {
        const parts = n.trim().split(/\s+as\s+/);
        imports.push({ name: parts[0].trim(), source, alias: parts[1]?.trim(), type: 'named', range: { start: { line, column: 1 }, end: { line, column: matchLen } } });
      });
    }
    if (sideNamed) {
      const matchLen = match[0].length;
      sideNamed.split(',').forEach((n) => {
        imports.push({ name: n.trim(), source, type: 'named', range: { start: { line, column: 1 }, end: { line, column: matchLen } } });
      });
    }
    if (!default_ && !named && !sideNamed) {
      imports.push({ name: source, source, type: 'namespace', range: { start: { line, column: 1 }, end: { line, column: match[0].length } } });
    }
  }

  const requireRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const named = match[1];
    const default_ = match[2];
    const source = match[3];

    if (default_) {
      imports.push({ name: default_, source, type: 'default', range: { start: { line, column: 1 }, end: { line, column: match[0].length } } });
    }
    if (named) {
      const matchLen = match[0].length;
      named.split(',').forEach((n) => {
        imports.push({ name: n.trim(), source, type: 'named', range: { start: { line, column: 1 }, end: { line, column: matchLen } } });
      });
    }
  }

  return imports;
}

export function extractTypeScriptExports(code: string): ASTExport[] {
  const exports: ASTExport[] = [];

  const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum|abstract\s+class)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    exports.push({
      name: match[1],
      kind: match[0].includes('default') ? 'default' : 'named',
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  const defaultExportRegex = /export\s+default\s+(\w+)/g;
  while ((match = defaultExportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    if (!exports.some((e) => e.name === match![1])) {
      exports.push({
        name: match[1],
        kind: 'default',
        range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      });
    }
  }

  const reexportRegex = /export\s+\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  while ((match = reexportRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const items = match[1];
    const source = match[2];
    items.split(',').forEach((item) => {
      exports.push({
        name: item.trim(),
        kind: 'reexport',
        source,
        range: { start: { line, column: 1 }, end: { line, column: match![0].length } },
      });
    });
  }

  return exports;
}

export function extractTSFunctions(code: string): ASTFunction[] {
  const functions: ASTFunction[] = [];

  const namedFuncRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = namedFuncRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const params = match[2].split(',').map((p) => p.trim().split(':')[0].split('=')[0].trim()).filter(Boolean);
    functions.push({
      name: match[1],
      params,
      returnType: match[3]?.trim(),
      async: match[0].includes('async '),
      exported: match[0].includes('export '),
      decorators: [],
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      bodyStart: match.index + match[0].length,
      bodyEnd: findBraceEnd(code, match.index + match[0].length - 1),
    });
  }

  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*(?:async\s+)?(?:\(([^)]*)\)|[^=>]+)\s*=>/g;
  while ((match = arrowRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const params = match[2] ? match[2].split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean) : [];
    let bodyStart = match.index + match[0].length;
    let bodyEnd = code.length;
    if (code[bodyStart] === '{') {
      bodyEnd = findBraceEnd(code, bodyStart);
    }
    functions.push({
      name: match[1],
      params,
      returnType: undefined,
      async: match[0].includes('async '),
      exported: match[0].includes('export '),
      decorators: [],
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
      bodyStart,
      bodyEnd,
    });
  }

  return functions;
}

export function extractTSClasses(code: string): ASTClass[] {
  const classes: ASTClass[] = [];

  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const implementsList = match[3] ? match[3].split(',').map((i) => i.trim()) : [];

    const bodyStart = match.index + match[0].length;
    const bodyEnd = findBraceEnd(code, match.index + match[0].length - 1);
    const body = code.slice(bodyStart, bodyEnd);

    const methods: string[] = [];
    const methodRegex = /(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(\w+)\s*(?:<[^>]+>)?\s*\(/g;
    let mMatch: RegExpExecArray | null;
    while ((mMatch = methodRegex.exec(body)) !== null) {
      if (!isReservedWord(mMatch[1])) methods.push(mMatch[1]);
    }

    classes.push({
      name: match[1],
      superClass: match[2],
      implements: implementsList,
      exported: match[0].includes('export '),
      decorators: [],
      methods,
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return classes;
}

export function extractTSInterfaces(code: string): ASTInterface[] {
  const interfaces: ASTInterface[] = [];

  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+([^{]+))?\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = interfaceRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const extendsList = match[2] ? match[2].split(',').map((i) => i.trim()) : [];
    interfaces.push({
      name: match[1],
      extends: extendsList,
      exported: match[0].includes('export '),
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return interfaces;
}

export function extractTSTypes(code: string): ASTTypeAlias[] {
  const types: ASTTypeAlias[] = [];

  const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*(.+?)(?:;|\n)/g;
  let match: RegExpExecArray | null;
  while ((match = typeRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    types.push({
      name: match[1],
      type: match[2].trim(),
      exported: match[0].includes('export '),
      range: { start: { line, column: 1 }, end: { line, column: match[0].length } },
    });
  }

  return types;
}

export function extractTSRoutes(code: string, filePath: string): ASTRoute[] {
  const routes: ASTRoute[] = [];

  const expressMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

  for (const method of expressMethods) {
    const regex = new RegExp(
      `app\\.${method}\\s*\\(\\s*['"]([^'"]+)['"]`,
      'g',
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[1],
        method: method.toUpperCase(),
        handler: 'anonymous',
        framework: 'express',
        file: filePath,
        line,
      });
    }
  }

  for (const method of expressMethods) {
    const regex = new RegExp(
      `router\\.${method}\\s*\\(\\s*['"]([^'"]+)['"]`,
      'g',
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[1],
        method: method.toUpperCase(),
        handler: 'anonymous',
        framework: 'express',
        file: filePath,
        line,
      });
    }
  }

  const nestControllerRegex = /@(?:Get|Post|Put|Delete|Patch|Head|Options|All)\s*\(\s*['"]([^'"]+)['"]?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = nestControllerRegex.exec(code)) !== null) {
    const line = code.slice(0, match.index).split('\n').length;
    const decoratorName = match[0].match(/@(\w+)/)?.[1] || 'Get';
    const method = decoratorName === 'All' ? 'ALL' : decoratorName.toUpperCase();

    const nextLine = code.slice(match.index + match[0].length).trim().split('\n')[0] || '';
    const fnMatch = nextLine.match(/(?:async\s+)?(\w+)\s*\(/);
    const handler = fnMatch ? fnMatch[1] : 'unknown';

    routes.push({
      path: match[1],
      method,
      handler,
      framework: 'nestjs',
      file: filePath,
      line,
    });
  }

  const nextApiRegex = /(?:GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"]([^'"]+)['"]/g;
  while ((match = nextApiRegex.exec(code)) !== null) {
    if (code.includes('NextRequest') || code.includes('NextResponse') || code.includes('next/server')) {
      const line = code.slice(0, match.index).split('\n').length;
      routes.push({
        path: match[1],
        method: match[0].match(/^(\w+)/)?.[1] || 'GET',
        handler: 'handler',
        framework: 'nextjs',
        file: filePath,
        line,
      });
    }
  }

  return routes;
}

export function extractTSCalls(code: string): ASTCall[] {
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
  let inTemplate = false;

  for (let i = openBraceIndex; i < code.length; i++) {
    const ch = code[i];
    const prev = code[i - 1];

    if (inTemplate) {
      if (ch === '`' && prev !== '\\') inTemplate = false;
      continue;
    }
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }

    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '`') { inTemplate = true; continue; }

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
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
    'instanceof', 'in', 'of', 'class', 'function', 'var', 'let', 'const',
    'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'static',
    'extends', 'super', 'this', 'void', 'with', 'debugger', 'true', 'false',
    'null', 'undefined', 'enum', 'interface', 'implements', 'package',
    'private', 'protected', 'public', 'abstract', 'constructor',
  ]);
  return reserved.has(word);
}
