
export function parseTSDeps(code: string): string[] {
  const deps: string[] = [];
  const importRegex = /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

export function parseTSFunctions(code: string): string[] {
  const funcs: string[] = [];

  const namedFuncRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
  let match;
  while ((match = namedFuncRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }

  const arrowFuncRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])=>/g;
  while ((match = arrowFuncRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }

  return funcs;
}

export function parseTSClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /(?:export\s+)?class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}
