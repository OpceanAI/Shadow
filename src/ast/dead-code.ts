import { ASTResult, ASTDeadCode } from './types';
import { ASTEngine } from './engine';

export function detectDeadCode(ast: ASTResult): ASTDeadCode {
  const unusedImports = findUnusedImports(ast);
  const unusedVariables = findUnusedVariables(ast);
  const unusedFunctions = findUnusedFunctions(ast);

  return {
    unusedImports,
    unusedFunctions,
    unusedVariables,
    uncalledFunctions: [],
  };
}

export function detectDeadCodeMulti(results: ASTResult[]): ASTDeadCode {
  const allCalled: Set<string> = new Set();
  const allDefined: Set<string> = new Set();
  const allImports: string[] = [];
  const allVariables: string[] = [];

  for (const ast of results) {
    for (const call of ast.calls) {
      allCalled.add(call.callee);
      allCalled.add(call.name);
    }
    for (const fn of ast.functions) {
      allDefined.add(fn.name);
    }
    for (const imp of ast.imports) {
      allImports.push(imp.name);
    }
    for (const v of ast.variables) {
      allVariables.push(v.name);
    }
  }

  const uncalledFunctions: string[] = [];
  for (const name of allDefined) {
    if (!allCalled.has(name) && !name.startsWith('_')) {
      uncalledFunctions.push(name);
    }
  }

  return {
    unusedImports: allImports.filter((i) => {
      for (const imp of allImports) {
        if (imp === i) continue;
      }
      return false;
    }),
    unusedFunctions: [],
    unusedVariables: allVariables.filter((v) => !allCalled.has(v)),
    uncalledFunctions,
  };
}

function findUnusedImports(ast: ASTResult): string[] {
  const unused: string[] = [];
  for (const imp of ast.imports) {
    const name = imp.name;
    let used = false;

    for (const call of ast.calls) {
      if (call.name === name || call.callee === name) {
        used = true;
        break;
      }
    }

    for (const cls of ast.classes) {
      if (cls.name === name) {
        used = true;
        break;
      }
    }

    for (const fn of ast.functions) {
      if (fn.decorators.includes(name)) {
        used = true;
        break;
      }
    }

    if (!used) {
      unused.push(name);
    }
  }
  return unused;
}

function findUnusedVariables(ast: ASTResult): string[] {
  const unused: string[] = [];
  for (const v of ast.variables) {
    const name = v.name;
    if (name.startsWith('_')) continue;

    let used = false;
    for (const call of ast.calls) {
      if (call.name === name || call.callee === name) {
        used = true;
        break;
      }
    }

    for (const exp of ast.exports) {
      if (exp.name === name) {
        used = true;
        break;
      }
    }

    if (!used) {
      unused.push(name);
    }
  }
  return unused;
}

function findUnusedFunctions(ast: ASTResult): string[] {
  const unused: string[] = [];
  const allFunctionNames = new Set(ast.functions.map((f) => f.name));
  const allCallNames = new Set(ast.calls.map((c) => c.callee).concat(ast.calls.map((c) => c.name)));

  for (const fnName of allFunctionNames) {
    if (fnName.startsWith('_')) continue;

    let used = false;

    if (allCallNames.has(fnName)) {
      used = true;
    }

    for (const exp of ast.exports) {
      if (exp.name === fnName) {
        used = true;
        break;
      }
    }

    for (const cls of ast.classes) {
      if (cls.methods.includes(fnName)) {
        used = true;
        break;
      }
    }

    if (!used) {
      unused.push(fnName);
    }
  }

  return unused;
}

export function detectDeadCodeInProject(
  filePaths: string[],
  engine: ASTEngine,
): ASTDeadCode {
  const results = filePaths
    .map((path) => {
      try {
        return engine.parseFile(path);
      } catch {
        return null;
      }
    })
    .filter((r): r is ASTResult => r !== null);

  return detectDeadCodeMulti(results);
}
