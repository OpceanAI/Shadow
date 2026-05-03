export function parseElixirImports(code: string): string[] {
  const imports: string[] = [];
  const aliasRegex = /alias\s+([\w.]+)/g;
  const importRegex = /import\s+([\w.]+)/g;
  const requireRegex = /require\s+([\w.]+)/g;
  let match;
  while ((match = aliasRegex.exec(code)) !== null) imports.push(match[1]);
  while ((match = importRegex.exec(code)) !== null) imports.push(match[1]);
  while ((match = requireRegex.exec(code)) !== null) imports.push(match[1]);
  return imports;
}

export function parseElixirModules(code: string): string[] {
  const modules: string[] = [];
  const moduleRegex = /defmodule\s+([\w.]+)/g;
  let match;
  while ((match = moduleRegex.exec(code)) !== null) {
    modules.push(match[1]);
  }
  return modules;
}

export function parseElixirFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /def(?:p)?\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parseElixirEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex1 = /System\.get_env\s*\(\s*"(\w+)"\s*\)/g;
  const envRegex2 = /Application\.get_env\s*\([\w:]+\s*,\s*:(\w+)/g;
  let match;
  while ((match = envRegex1.exec(code)) !== null) vars.push(match[1]);
  while ((match = envRegex2.exec(code)) !== null) vars.push(match[1]);
  return vars;
}

export function detectElixirFramework(code: string, filePath: string): string | undefined {
  if (code.includes('Plug.Conn') || filePath.includes('lib/') && filePath.includes('_web/')) {
    return 'Phoenix';
  }
  if (code.includes('use Phoenix.')) {
    return 'Phoenix';
  }
  if (code.includes('use Absinthe.')) {
    return 'Absinthe';
  }
  return undefined;
}
