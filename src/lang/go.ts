export function parseGoDeps(code: string): string[] {
  const deps: string[] = [];
  const importRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)")/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const block = match[1];
    if (block) {
      block.split('\n').forEach((line) => {
        const trimmed = line.trim().replace(/"/g, '');
        if (trimmed) deps.push(trimmed);
      });
    } else if (match[2]) {
      deps.push(match[2]);
    }
  }
  return deps;
}

export function parseGoFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}
