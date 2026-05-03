import { ASTRoute } from './types';
import { ASTEngine } from './engine';
import { parsePython, extractPythonRoutes } from './python-parser';
import { parseTypeScript, extractTSRoutes } from './typescript-parser';
import { parseGo, extractGoRoutes } from './go-parser';
import { parseRust, extractRustRoutes } from './rust-parser';

export function extractRoutes(code: string, language: string, filePath: string): ASTRoute[] {
  switch (language) {
    case 'python':
      return extractPythonRoutes(code, filePath);
    case 'typescript':
    case 'javascript':
      return extractTSRoutes(code, filePath);
    case 'go':
      return extractGoRoutes(code, filePath);
    case 'rust':
      return extractRustRoutes(code, filePath);
    default:
      return [];
  }
}

export function extractAllRoutes(
  files: { path: string; code: string; language: string }[],
): ASTRoute[] {
  const allRoutes: ASTRoute[] = [];

  for (const file of files) {
    let routes: ASTRoute[] = [];
    switch (file.language) {
      case 'python':
        routes = extractPythonRoutes(file.code, file.path);
        break;
      case 'typescript':
      case 'javascript':
        routes = extractTSRoutes(file.code, file.path);
        break;
      case 'go':
        routes = extractGoRoutes(file.code, file.path);
        break;
      case 'rust':
        routes = extractRustRoutes(file.code, file.path);
        break;
    }
    allRoutes.push(...routes);
  }

  return allRoutes;
}

export function groupRoutesByFramework(
  routes: ASTRoute[],
): Map<string, ASTRoute[]> {
  const grouped = new Map<string, ASTRoute[]>();
  for (const route of routes) {
    const key = route.framework;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(route);
  }
  return grouped;
}

export function printRouteTable(routes: ASTRoute[]): string {
  const lines: string[] = [];
  const grouped = groupRoutesByFramework(routes);

  for (const [framework, fwRoutes] of grouped) {
    lines.push(`\n[${framework}]`);
    const maxMethod = Math.max(...fwRoutes.map((r) => r.method.length));
    const maxPath = Math.max(...fwRoutes.map((r) => r.path.length));

    for (const route of fwRoutes) {
      const methodPad = ' '.repeat(maxMethod - route.method.length + 1);
      const pathPad = ' '.repeat(maxPath - route.path.length + 1);
      lines.push(`  ${route.method}${methodPad}${route.path}${pathPad}→ ${route.handler}`);
    }
  }

  return lines.join('\n');
}
