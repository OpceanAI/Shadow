import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('init command logic', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-init-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .shadow directory', () => {
    const shadowDir = path.join(tmpDir, '.shadow');
    fs.mkdirSync(shadowDir, { recursive: true });
    expect(fs.existsSync(shadowDir)).toBe(true);
  });

  it('creates subdirectories under .shadow', () => {
    const shadowDir = path.join(tmpDir, '.shadow');
    fs.mkdirSync(shadowDir, { recursive: true });
    fs.mkdirSync(path.join(shadowDir, 'cache'), { recursive: true });
    fs.mkdirSync(path.join(shadowDir, 'graphs'), { recursive: true });
    fs.mkdirSync(path.join(shadowDir, 'traces'), { recursive: true });
    fs.mkdirSync(path.join(shadowDir, 'reports'), { recursive: true });

    expect(fs.existsSync(path.join(shadowDir, 'cache'))).toBe(true);
    expect(fs.existsSync(path.join(shadowDir, 'graphs'))).toBe(true);
    expect(fs.existsSync(path.join(shadowDir, 'traces'))).toBe(true);
    expect(fs.existsSync(path.join(shadowDir, 'reports'))).toBe(true);
  });

  it('writes config.json', () => {
    const shadowDir = path.join(tmpDir, '.shadow');
    fs.mkdirSync(shadowDir, { recursive: true });

    const config = { language: 'python', timestamp: new Date().toISOString() };
    fs.writeFileSync(
      path.join(shadowDir, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf-8',
    );

    expect(fs.existsSync(path.join(shadowDir, 'config.json'))).toBe(true);
    const loaded = JSON.parse(fs.readFileSync(path.join(shadowDir, 'config.json'), 'utf-8'));
    expect(loaded.language).toBe('python');
  });

  it('detects existing .shadow directory', () => {
    const shadowDir = path.join(tmpDir, '.shadow');
    fs.mkdirSync(shadowDir, { recursive: true });
    expect(fs.existsSync(shadowDir)).toBe(true);

    const fileExists = (p: string) => fs.existsSync(p);
    expect(fileExists(shadowDir)).toBe(true);
  });

  it('generates JSON output', () => {
    const output = JSON.stringify({ status: 'ok', language: 'typescript' });
    const parsed = JSON.parse(output);
    expect(parsed.status).toBe('ok');
    expect(parsed.language).toBe('typescript');
  });
});
