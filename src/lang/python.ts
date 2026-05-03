import { FileInfo } from '../types';

export function parsePythonDeps(code: string): string[] {
  const deps: string[] = [];
  const importRegex = /^(?:from|import)\s+([\w.]+)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

export function parsePythonFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /^def\s+(\w+)/gm;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parsePythonClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /^class\s+(\w+)/gm;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}
