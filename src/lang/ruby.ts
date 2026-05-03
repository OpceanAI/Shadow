export function parseRubyRequires(code: string): string[] {
  const requires: string[] = [];
  const requireRegex = /require\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = requireRegex.exec(code)) !== null) {
    requires.push(match[1]);
  }
  return requires;
}

export function parseRubyModules(code: string): string[] {
  const modules: string[] = [];
  const moduleRegex = /module\s+(\w+)/g;
  let match;
  while ((match = moduleRegex.exec(code)) !== null) {
    modules.push(match[1]);
  }
  return modules;
}

export function parseRubyClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)(?:\s*<\s*\w+)?/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseRubyMethods(code: string): string[] {
  const methods: string[] = [];
  const methodRegex = /def\s+(?:self\.)?(\w+[?!]?)/g;
  let match;
  while ((match = methodRegex.exec(code)) !== null) {
    methods.push(match[1]);
  }
  return methods;
}

export function parseRubyEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /ENV\[['"](\w+)['"]\]|ENV\.fetch\(['"](\w+)['"]\)/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1] || match[2]);
  }
  return vars;
}

export function detectRubyFramework(filePath: string): string | undefined {
  if (filePath.includes('app/controllers') || filePath.includes('app/models') ||
      filePath.includes('config/routes')) {
    return 'Ruby on Rails';
  }
  if (filePath.includes('app.rb') || filePath.includes('sinatra')) {
    return 'Sinatra';
  }
  if (filePath.includes('hanami') || filePath.includes('hanami.rb')) {
    return 'Hanami';
  }
  return undefined;
}
