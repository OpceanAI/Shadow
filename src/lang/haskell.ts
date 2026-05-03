export function parseHaskellImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:qualified\s+)?([\w.]+)/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function parseHaskellDataTypes(code: string): string[] {
  const types: string[] = [];
  const dataRegex = /data\s+(\w+)\s*=/g;
  const newtypeRegex = /newtype\s+(\w+)\s*=/g;
  const typeRegex = /type\s+(\w+)\s*=/g;
  let match;
  while ((match = dataRegex.exec(code)) !== null) types.push(match[1]);
  while ((match = newtypeRegex.exec(code)) !== null) types.push(match[1]);
  while ((match = typeRegex.exec(code)) !== null) types.push(match[1]);
  return types;
}

export function parseHaskellFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /^(\w+)\s*::/gm;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parseHaskellModules(code: string): string[] {
  const modules: string[] = [];
  const moduleRegex = /module\s+([\w.]+)/g;
  let match;
  while ((match = moduleRegex.exec(code)) !== null) {
    modules.push(match[1]);
  }
  return modules;
}

export function parseHaskellEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /getEnv\s+"(\w+)"/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function detectHaskellFramework(code: string, filePath: string): string | undefined {
  if (code.includes('Network.Wai') || code.includes('Warp')) {
    return 'Warp/WAI';
  }
  if (code.includes('Yesod')) {
    return 'Yesod';
  }
  if (code.includes('Servant')) {
    return 'Servant';
  }
  if (code.includes('Scotty')) {
    return 'Scotty';
  }
  return undefined;
}
