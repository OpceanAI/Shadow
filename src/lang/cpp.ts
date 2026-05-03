export function parseCppIncludes(code: string): string[] {
  const includes: string[] = [];
  const includeRegex = /#include\s+[<"]([^>"]+)[>"]/g;
  let match;
  while ((match = includeRegex.exec(code)) !== null) {
    includes.push(match[1]);
  }
  return includes;
}

export function parseCppFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /(?:[\w:]+\s+)+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    const name = match[1];
    if (!['if', 'for', 'while', 'switch', 'return'].includes(name)) {
      funcs.push(name);
    }
  }
  return funcs;
}

export function parseCppClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /(?:class|struct)\s+(\w+)\s*(?::\s*\w+\s+\w+)?\s*\{/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseCppEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /getenv\s*\(\s*"(\w+)"\s*\)/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function parseCppDefines(code: string): string[] {
  const defines: string[] = [];
  const defineRegex = /#define\s+(\w+)/g;
  let match;
  while ((match = defineRegex.exec(code)) !== null) {
    defines.push(match[1]);
  }
  return defines;
}
