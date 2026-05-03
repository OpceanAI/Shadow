export function parseSwiftImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(\w+)/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

export function parseSwiftClasses(code: string): string[] {
  const classes: string[] = [];
  const classRegex = /class\s+(\w+)/g;
  let match;
  while ((match = classRegex.exec(code)) !== null) {
    classes.push(match[1]);
  }
  return classes;
}

export function parseSwiftStructs(code: string): string[] {
  const structs: string[] = [];
  const structRegex = /struct\s+(\w+)/g;
  let match;
  while ((match = structRegex.exec(code)) !== null) {
    structs.push(match[1]);
  }
  return structs;
}

export function parseSwiftFunctions(code: string): string[] {
  const funcs: string[] = [];
  const funcRegex = /func\s+(\w+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    funcs.push(match[1]);
  }
  return funcs;
}

export function parseSwiftEnvVars(code: string): string[] {
  const vars: string[] = [];
  const envRegex = /ProcessInfo\.processInfo\.environment\["(\w+)"\]/g;
  let match;
  while ((match = envRegex.exec(code)) !== null) {
    vars.push(match[1]);
  }
  return vars;
}

export function detectSwiftFramework(filePath: string): string | undefined {
  if (filePath.includes('Package.swift') || filePath.includes('Sources/') && filePath.includes('Vapor')) {
    return 'Vapor';
  }
  if (filePath.includes('Kitura')) {
    return 'Kitura';
  }
  if (filePath.includes('Perfect')) {
    return 'Perfect';
  }
  if (filePath.includes('import SwiftUI')) {
    return 'SwiftUI';
  }
  if (filePath.includes('import UIKit')) {
    return 'UIKit';
  }
  return undefined;
}
