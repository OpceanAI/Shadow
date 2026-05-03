import * as fs from 'fs';
import { ASTResult } from './types';
import { parsePython } from './python-parser';
import { parseTypeScript } from './typescript-parser';
import { parseGo } from './go-parser';
import { parseRust } from './rust-parser';
import { parseFallback } from './regex-fallback';
import { detectLanguage } from '../lang/detector';

export interface ASTEngineOptions {
  useTreeSitter: boolean;
  fallbackToRegex: boolean;
  timeout: number;
}

const defaultOptions: ASTEngineOptions = {
  useTreeSitter: false,
  fallbackToRegex: true,
  timeout: 5000,
};

let treeSitterAvailable: boolean | null = null;

function checkTreeSitter(): boolean {
  if (treeSitterAvailable !== null) return treeSitterAvailable;
  try {
    require('tree-sitter');
    treeSitterAvailable = true;
  } catch {
    treeSitterAvailable = false;
  }
  return treeSitterAvailable;
}

export class ASTEngine {
  private options: ASTEngineOptions;

  constructor(options: Partial<ASTEngineOptions> = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  parse(code: string, language?: string, filePath?: string): ASTResult {
    const startTime = Date.now();

    const lang = language || detectLanguage(filePath || 'unknown');
    const path = filePath || '<input>';

    let result: ASTResult;

    if (this.options.useTreeSitter && checkTreeSitter()) {
      try {
        result = this.parseWithTreeSitter(code, lang, path);
      } catch {
        if (this.options.fallbackToRegex) {
          result = this.parseWithRegex(code, lang, path);
        } else {
          result = this.emptyResult(lang, path);
        }
      }
    } else {
      result = this.parseWithRegex(code, lang, path);
    }

    result.parseTime = Date.now() - startTime;
    return result;
  }

  parseFile(filePath: string): ASTResult {
    const code = fs.readFileSync(filePath, 'utf-8');
    const lang = detectLanguage(filePath);
    return this.parse(code, lang, filePath);
  }

  parseMultipleFiles(filePaths: string[]): ASTResult[] {
    return filePaths.map((path) => {
      try {
        return this.parseFile(path);
      } catch {
        return this.emptyResult(detectLanguage(path), path);
      }
    });
  }

  private parseWithTreeSitter(code: string, language: string, filePath: string): ASTResult {
    const Parser = require('tree-sitter');

    const langMap: Record<string, string> = {
      python: 'tree-sitter-python',
      typescript: 'tree-sitter-typescript',
      javascript: 'tree-sitter-javascript',
      rust: 'tree-sitter-rust',
      go: 'tree-sitter-go',
      tsx: 'tree-sitter-tsx',
    };

    const langName = langMap[language];
    if (!langName) {
      throw new Error(`No tree-sitter grammar for ${language}`);
    }

    try {
      const grammar = require(langName);
      const parser = new Parser();
      parser.setLanguage(grammar);
      const tree = parser.parse(code);
      const rootNode = tree.rootNode;

      return this.extractFromTreeSitter(rootNode, language, filePath, code);
    } catch {
      throw new Error(`Failed to parse ${language} with tree-sitter`);
    }
  }

  private extractFromTreeSitter(_node: unknown, language: string, filePath: string, _code: string): ASTResult {
    // Placeholder for tree-sitter extraction
    // Falls through to regex fallback
    throw new Error('Tree-sitter extraction not implemented, falling to regex');
  }

  private parseWithRegex(code: string, language: string, filePath: string): ASTResult {
    switch (language) {
      case 'python':
        return parsePython(code, filePath);
      case 'typescript':
      case 'javascript':
        return parseTypeScript(code, filePath);
      case 'go':
        return parseGo(code, filePath);
      case 'rust':
        return parseRust(code, filePath);
      default:
        return parseFallback(code, language, filePath);
    }
  }

  private emptyResult(language: string, filePath: string): ASTResult {
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
      complexity: {
        cyclomaticComplexity: 0,
        linesOfCode: 0,
        nestingDepth: 0,
        functionLength: 0,
        parameterCount: 0,
      },
      deadCode: {
        unusedImports: [],
        unusedFunctions: [],
        unusedVariables: [],
        uncalledFunctions: [],
      },
      parseTime: 0,
    };
  }
}
