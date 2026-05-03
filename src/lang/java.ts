export function parseJavaImports(code: string): string[] {
  const deps: string[] = [];
  const importRegex = /import\s+(?:static\s+)?([\w.]+)/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    deps.push(match[1]);
  }
  return deps;
}

export function parseJavaClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseJavaMethods(code: string): string[] {
  const methods: string[] = [];
  const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:[\w<>]+\s+)+(\w+)\s*\(/g;
  let match;
  while ((match = methodRegex.exec(code)) !== null) {
    methods.push(match[1]);
  }
  return methods;
}

export function parseJavaAnnotations(code: string): string[] {
  const annotations: string[] = [];
  const annotationRegex = /@(\w+)/g;
  let match;
  while ((match = annotationRegex.exec(code)) !== null) {
    annotations.push(match[1]);
  }
  return annotations;
}

export function parseJavaEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /System\.getenv\s*\(\s*"(\w+)"\s*\)/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function detectJavaFramework(code: string, filePath: string): string | undefined {
  if (code.includes('org.springframework.boot') ||
      code.includes('@SpringBootApplication') ||
      code.includes('@RestController') ||
      filePath.includes('Application.java')) {
    return 'Spring Boot';
  }
  if (code.includes('javax.ws.rs') || code.includes('jakarta.ws.rs')) {
    return 'JAX-RS';
  }
  if (code.includes('io.micronaut')) {
    return 'Micronaut';
  }
  if (code.includes('io.quarkus')) {
    return 'Quarkus';
  }
  if (code.includes('play.mvc') || code.includes('play.api')) {
    return 'Play Framework';
  }
  return undefined;
}
