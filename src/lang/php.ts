export function parsePhpUses(code: string): string[] {
  const uses: string[] = [];
  const useRegex = /use\s+([\w\\]+)(?:\s+as\s+\w+)?\s*;/g;
  let match;
  while ((match = useRegex.exec(code)) !== null) {
    uses.push(match[1]);
  }
  return uses;
}

export function parsePhpClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w\s,]+)?/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parsePhpFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /function\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parsePhpEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex1 = /getenv\s*\(\s*['"](\w+)['"]\s*\)/g;
  const envRegex2 = /\$_ENV\s*\[\s*['"](\w+)['"]\s*\]/g;
  const envRegex3 = /env\s*\(\s*['"](\w+)['"]\s*\)/g;
  let match;
  while ((match = envRegex1.exec(code)) !== null) vars.push(match[1]);
  while ((match = envRegex2.exec(code)) !== null) vars.push(match[1]);
  while ((match = envRegex3.exec(code)) !== null) vars.push(match[1]);
  return vars;
}

export function detectPhpFramework(filePath: string): string | undefined {
  if (filePath.includes('app/Http/Controllers') || filePath.includes('routes/web.php') ||
      filePath.includes('artisan')) {
    return 'Laravel';
  }
  if (filePath.includes('src/Controller') || filePath.includes('config/routes')) {
    return 'Symfony';
  }
  if (filePath.includes('laminas') || filePath.includes('module.config')) {
    return 'Laminas';
  }
  if (filePath.includes('yii') || filePath.includes('Yii.php')) {
    return 'Yii';
  }
  return undefined;
}
