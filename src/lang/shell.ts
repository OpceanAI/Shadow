export function parseShellFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /^(?:function\s+)?(\w+)\s*\(\s*\)\s*\{/gm;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}
