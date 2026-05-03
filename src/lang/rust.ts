export function parseRustDeps(code: string): string[] {
  const deps: string[] = [];
  const useRegex = /^use\s+([\w:]+)/gm;
  let match;
  while ((match = useRegex.exec(code)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

export function parseRustFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /(?:pub\s+)?fn\s+(\w+)/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}
