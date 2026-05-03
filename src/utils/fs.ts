import * as fs from 'fs';
import * as path from 'path';

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read file "${filePath}": ${message}`);
  }
}

export function readJSON<T>(filePath: string): T {
  try {
    const raw = readFile(filePath);
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read JSON from "${filePath}": ${message}`);
  }
}

export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function findFiles(root: string, patterns: string[]): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        for (const pattern of patterns) {
          if (entry.name.endsWith(pattern.replace('*.', '.'))) {
            results.push(fullPath);
            break;
          }
        }
      }
    }
  }
  walk(root);
  return results;
}

export function getProjectRoot(startPath: string): string {
  let current = path.resolve(startPath);
  while (current !== '/') {
    if (
      fs.existsSync(path.join(current, '.git')) ||
      fs.existsSync(path.join(current, 'package.json')) ||
      fs.existsSync(path.join(current, 'Cargo.toml')) ||
      fs.existsSync(path.join(current, 'go.mod')) ||
      fs.existsSync(path.join(current, 'pyproject.toml'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  return startPath;
}
