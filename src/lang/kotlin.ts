export function parseKotlinImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+([\w.]+)/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function parseKotlinClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /(?:data\s+)?(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseKotlinFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /(?:suspend\s+)?fun\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parseKotlinEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /System\.getenv\s*\(\s*"(\w+)"\s*\)/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function detectKotlinFramework(code: string, filePath: string): string | undefined {
  if (code.includes('org.springframework.boot') || code.includes('@SpringBootApplication') ||
      code.includes('@RestController')) {
    return 'Spring Boot';
  }
  if (code.includes('io.ktor') || code.includes('ktor.')) {
    return 'Ktor';
  }
  if (code.includes('androidx') || code.includes('android.os')) {
    return 'Android';
  }
  return undefined;
}
