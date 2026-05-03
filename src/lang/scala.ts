export function parseScalaImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+([\w.]+)(?:\.[{_])?/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function parseScalaClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /(?:case\s+)?class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseScalaObjects(code: string): string[] {
  const objects: string[] = [];
  const objectRegex = /object\s+(\w+)/g;
  let match;
  while ((match = objectRegex.exec(code)) !== null) {
    objects.push(match[1]);
  }
  return objects;
}

export function parseScalaFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /def\s+(\w+)\s*\[?[\w\s,]*\]?\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parseScalaEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /sys\.env\.get\s*\(\s*"(\w+)"\s*\)/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function detectScalaFramework(code: string, filePath: string): string | undefined {
  if (code.includes('play.api') || code.includes('play.mvc') || filePath.includes('conf/routes')) {
    return 'Play Framework';
  }
  if (code.includes('akka.actor') || code.includes('akka.http')) {
    return 'Akka';
  }
  if (code.includes('zio.')) {
    return 'ZIO';
  }
  if (code.includes('cats.')) {
    return 'Cats Effect';
  }
  return undefined;
}
