import { ProjectInfo, ShadowConfig, SupportedLanguage } from '../types';
import { findFiles, getProjectRoot, readFile } from '../utils/fs';
import { getEnvVarsFromCode } from '../utils/env';
import { detectLanguage } from '../lang/detector';
import { ASTEngine, detectFramework } from '../ast';

export class Analyzer {
  private config: ShadowConfig;
  private rootPath: string;
  private astEngine: ASTEngine;

  constructor(config: ShadowConfig, rootPath?: string) {
    this.config = config;
    this.rootPath = rootPath || process.cwd();
    this.astEngine = new ASTEngine({ useTreeSitter: false, fallbackToRegex: true });
  }

  analyzeProject(): ProjectInfo {
    const root = getProjectRoot(this.rootPath);
    const language = detectLanguage(root);
    const files = this.listSourceFiles(root);
    const fileInfos = files.map((f) => this.analyzeFile(f, root));

    const allEnvVars = new Set<string>();
    const allExternalAPIs = new Set<string>();
    const entryPoints: string[] = [];

    for (const fi of fileInfos) {
      fi.envVars.forEach((e) => allEnvVars.add(e));
      fi.externalCalls.forEach((c) => allExternalAPIs.add(c));
      if (fi.exports.length > 0 || fi.functions.some((f) => f === 'main')) {
        entryPoints.push(fi.path);
      }
    }

    return {
      name: root.split('/').pop() || 'unknown',
      rootPath: root,
      language,
      summary: `${language} project with ${files.length} files`,
      files: fileInfos,
      entryPoints,
      envVars: Array.from(allEnvVars),
      externalAPIs: Array.from(allExternalAPIs),
      totalFiles: files.length,
      graph: { nodes: [], edges: [] },
    };
  }

  analyzeFile(filePath: string, root?: string): import('../types').FileInfo {
    const rootDir = root || getProjectRoot(filePath);
    const content = readFile(filePath);
    const lang = detectLanguage(filePath);
    const relativePath = filePath.replace(rootDir, '').replace(/^\//, '');

    let ast;
    try {
      ast = this.astEngine.parse(content, lang, relativePath);
    } catch {
      ast = null;
    }

    return {
      path: relativePath,
      language: lang,
      purpose: ast
        ? this.guessPurposeFromAST(ast, relativePath)
        : this.guessPurpose(relativePath, lang),
      imports: ast
        ? ast.imports
            .filter((imp) => imp.name || imp.source)
            .map((imp) => ({
            name: imp.alias || imp.name || imp.source || '',
            type: ((imp.source || imp.name || '').startsWith('.') || (imp.source || imp.name || '').startsWith('/') ? 'internal' : 'external') as 'internal' | 'external',
            path: imp.source || imp.name || '',
          }))
        : this.extractImports(content, lang),
      exports: ast
        ? ast.exports.map((e) => e.name)
        : this.extractExports(content, lang),
      functions: ast
        ? ast.functions.map((f) => f.name)
        : this.extractFunctions(content, lang),
      classes: ast
        ? ast.classes.map((c) => c.name)
        : this.extractClasses(content, lang),
      envVars: getEnvVarsFromCode(content),
      externalCalls: this.extractExternalCalls(content),
      dependencies: [],
    };
  }

  private listSourceFiles(root: string): string[] {
    const patterns = [
      '*.py', '*.ts', '*.tsx', '*.js', '*.jsx', '*.rs',
      '*.go', '*.sh', '*.bash', '*.zsh',
    ];
    return findFiles(root, patterns);
  }

  private guessPurposeFromAST(ast: import('../ast').ASTResult, relativePath: string): string {
    const framework = detectFramework(ast);
    if (framework.name !== 'none') {
      return `${framework.name} ${this.guessPurpose(relativePath, ast.language as SupportedLanguage)}`;
    }
    return this.guessPurpose(relativePath, ast.language as SupportedLanguage);
  }

  private guessPurpose(relativePath: string, lang: SupportedLanguage): string {
    if (relativePath.includes('test')) return 'Test file';
    if (relativePath.includes('main') || relativePath.includes('index')) return 'Entry point';
    if (relativePath.includes('config')) return 'Configuration';
    if (relativePath.includes('route')) return 'Route handler';
    if (relativePath.includes('model')) return 'Data model';
    if (relativePath.includes('util')) return 'Utility';
    return 'Source file';
  }

  private extractImports(code: string, lang: SupportedLanguage): import('../types').ImportInfo[] {
    const imports: import('../types').ImportInfo[] = [];
    const seen = new Set<string>();

    const addImport = (name: string) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      const isInternal = name.startsWith('.') || name.startsWith('/') || name.startsWith('./') || name.startsWith('../');
      imports.push({
        name,
        type: isInternal ? 'internal' : 'external',
      });
    };

    if (lang === 'python') {
      const fromRegex = /from\s+([\w.]+)\s+import/g;
      let match;
      while ((match = fromRegex.exec(code)) !== null) addImport(match[1]);

      const importRegex = /^import\s+([\w.]+)/gm;
      while ((match = importRegex.exec(code)) !== null) {
        match[1].split(',').forEach((m) => addImport(m.trim()));
      }
    } else if (lang === 'go') {
      const goImportBlockRegex = /import\s*\(([^)]+)\)/g;
      let match;
      while ((match = goImportBlockRegex.exec(code)) !== null) {
        const lines = match[1].split('\n');
        for (const line of lines) {
          const quoted = line.match(/"([^"]+)"/);
          if (quoted) addImport(quoted[1]);
        }
      }

      const goSingleImportRegex = /import\s+"([^"]+)"/g;
      while ((match = goSingleImportRegex.exec(code)) !== null) addImport(match[1]);
    } else if (lang === 'rust') {
      const useRegex = /use\s+([\w:]+)(?:::[{][^}]+[}])?/g;
      let match;
      while ((match = useRegex.exec(code)) !== null) {
        const crate = match[1].split('::')[0];
        addImport(crate);
      }
    } else if (lang === 'typescript' || lang === 'javascript') {
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
      let match;
      while ((match = requireRegex.exec(code)) !== null) addImport(match[1]);

      const importFromRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
      while ((match = importFromRegex.exec(code)) !== null) addImport(match[1]);

      const esImportRegex = /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"]+)['"]/g;
      while ((match = esImportRegex.exec(code)) !== null) addImport(match[1]);
    } else if (lang === 'shell') {
      const sourceRegex = /^(?:source|\.)\s+(.+)/gm;
      let match;
      while ((match = sourceRegex.exec(code)) !== null) addImport(match[1].trim());
    }

    return imports;
  }

  private extractExports(code: string, lang: SupportedLanguage): string[] {
    const exports: string[] = [];
    if (lang === 'typescript' || lang === 'javascript') {
      const regex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g;
      let match;
      while ((match = regex.exec(code)) !== null) {
        exports.push(match[1]);
      }
    }
    if (lang === 'python') {
      const regex = /^def\s+(\w+)/gm;
      let match;
      while ((match = regex.exec(code)) !== null) {
        exports.push(match[1]);
      }
    }
    return exports;
  }

  private extractFunctions(code: string, lang: SupportedLanguage): string[] {
    const funcs: string[] = [];
    if (lang === 'python') {
      const regex = /^def\s+(\w+)/gm;
      let match;
      while ((match = regex.exec(code)) !== null) funcs.push(match[1]);
    } else if (['typescript', 'javascript'].includes(lang)) {
      const regex = /function\s+(\w+)/g;
      let match;
      while ((match = regex.exec(code)) !== null) funcs.push(match[1]);
      const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
      while ((match = arrowRegex.exec(code)) !== null) funcs.push(match[1]);
    } else if (lang === 'rust') {
      const regex = /fn\s+(\w+)/g;
      let match;
      while ((match = regex.exec(code)) !== null) funcs.push(match[1]);
    } else if (lang === 'go') {
      const regex = /func\s+(?:\([^)]+\)\s+)?(\w+)/g;
      let match;
      while ((match = regex.exec(code)) !== null) funcs.push(match[1]);
    }
    return funcs;
  }

  private extractClasses(code: string, lang: SupportedLanguage): string[] {
    const classes: string[] = [];
    const classRegex = /^\s*(?:export\s+(?:default\s+)?)?class\s+(\w+)/gm;
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      classes.push(match[1]);
    }
    return classes;
  }

  private extractExternalCalls(code: string): string[] {
    const urls = new Set<string>();
    const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+)/g;
    let match;
    while ((match = urlRegex.exec(code)) !== null) {
      urls.add(match[1]);
    }
    return Array.from(urls);
  }
}
