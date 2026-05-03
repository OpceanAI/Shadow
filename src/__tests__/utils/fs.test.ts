import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileExists, readFile, writeFile, readJSON, findFiles, getProjectRoot } from '../../utils/fs';

describe('fileExists', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true for an existing file', () => {
    const filePath = path.join(tmpDir, 'exists.txt');
    fs.writeFileSync(filePath, 'hello');
    expect(fileExists(filePath)).toBe(true);
  });

  it('returns false for a non-existing file', () => {
    const filePath = path.join(tmpDir, 'does-not-exist.txt');
    expect(fileExists(filePath)).toBe(false);
  });

  it('returns true for an existing directory', () => {
    expect(fileExists(tmpDir)).toBe(true);
  });

  it('returns false for empty path (handles gracefully)', () => {
    expect(fileExists('')).toBe(false);
  });
});

describe('readFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads file content correctly', () => {
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'Hello, Shadow!');
    expect(readFile(filePath)).toBe('Hello, Shadow!');
  });

  it('reads empty file', () => {
    const filePath = path.join(tmpDir, 'empty.txt');
    fs.writeFileSync(filePath, '');
    expect(readFile(filePath)).toBe('');
  });

  it('reads multiline content', () => {
    const filePath = path.join(tmpDir, 'multi.txt');
    fs.writeFileSync(filePath, 'line1\nline2\nline3');
    expect(readFile(filePath)).toBe('line1\nline2\nline3');
  });

  it('throws for non-existent file', () => {
    expect(() => readFile('/nonexistent/path/to/file.txt')).toThrow();
  });

  it('reads UTF-8 content', () => {
    const filePath = path.join(tmpDir, 'utf8.txt');
    fs.writeFileSync(filePath, 'Café résumé naïve', 'utf-8');
    expect(readFile(filePath)).toBe('Café résumé naïve');
  });
});

describe('writeFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes content to a file', () => {
    const filePath = path.join(tmpDir, 'output.txt');
    writeFile(filePath, 'new content');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content');
  });

  it('creates parent directories if needed', () => {
    const filePath = path.join(tmpDir, 'a', 'b', 'c', 'output.txt');
    writeFile(filePath, 'deep content');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('deep content');
  });

  it('overwrites existing file', () => {
    const filePath = path.join(tmpDir, 'overwrite.txt');
    writeFile(filePath, 'first');
    writeFile(filePath, 'second');
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('second');
  });
});

describe('readJSON', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('parses valid JSON', () => {
    const filePath = path.join(tmpDir, 'config.json');
    fs.writeFileSync(filePath, JSON.stringify({ name: 'shadow', version: '0.1.0' }));
    const result = readJSON<{ name: string; version: string }>(filePath);
    expect(result).toEqual({ name: 'shadow', version: '0.1.0' });
  });

  it('parses JSON array', () => {
    const filePath = path.join(tmpDir, 'items.json');
    fs.writeFileSync(filePath, JSON.stringify([1, 2, 3]));
    expect(readJSON<number[]>(filePath)).toEqual([1, 2, 3]);
  });

  it('throws for invalid JSON', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, '{ invalid json }');
    expect(() => readJSON(filePath)).toThrow();
  });

  it('throws for non-existent file', () => {
    expect(() => readJSON('/nonexistent/file.json')).toThrow();
  });
});

describe('findFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-test-'));
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'main.py'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'lib.go'), '');
    fs.writeFileSync(path.join(tmpDir, 'src', 'app.rs'), '');
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds Python files', () => {
    const results = findFiles(tmpDir, ['*.py']);
    expect(results.length).toBe(1);
    expect(results[0]).toContain('main.py');
  });

  it('finds TypeScript files', () => {
    const results = findFiles(tmpDir, ['*.ts']);
    expect(results.length).toBe(1);
    expect(results[0]).toContain('index.ts');
  });

  it('finds multiple patterns', () => {
    const results = findFiles(tmpDir, ['*.py', '*.go', '*.rs']);
    expect(results.length).toBe(3);
  });

  it('finds all source files', () => {
    const results = findFiles(tmpDir, ['*.py', '*.ts', '*.tsx', '*.js', '*.jsx', '*.rs', '*.go']);
    expect(results.length).toBe(4);
  });

  it('skips node_modules directory', () => {
    const results = findFiles(tmpDir, ['*.ts']);
    const nodeModulesMatch = results.some(r => r.includes('node_modules'));
    expect(nodeModulesMatch).toBe(false);
  });

  it('skips dot directories', () => {
    fs.mkdirSync(path.join(tmpDir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.hidden', 'secret.py'), '');
    const results = findFiles(tmpDir, ['*.py']);
    expect(results.length).toBe(1);
  });

  it('returns empty array for no matches', () => {
    const results = findFiles(tmpDir, ['*.java']);
    expect(results).toEqual([]);
  });
});

describe('getProjectRoot', () => {
  it('finds root by .git', () => {
    const root = getProjectRoot(path.join(__dirname, '..', '..', '..', '..'));
    expect(root).toBeTruthy();
    expect(typeof root).toBe('string');
  });

  it('finds root by package.json', () => {
    const root = getProjectRoot(__dirname);
    expect(root).toBeTruthy();
    expect(fs.existsSync(path.join(root, 'package.json'))).toBe(true);
  });

  it('returns start path if nothing found', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-root-test-'));
    try {
      const root = getProjectRoot(tmpDir);
      expect(root).toBe(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('handles nested paths correctly', () => {
    const nested = path.join(__dirname, '..', '..', '..', '..');
    const root = getProjectRoot(nested);
    expect(root).toBeTruthy();
    expect(typeof root).toBe('string');
  });
});
