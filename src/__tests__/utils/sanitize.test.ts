import { describe, it, expect } from 'vitest';
import { maskSecret, sanitizePath, truncate, safeStringify } from '../../utils/sanitize';

describe('maskSecret', () => {
  it('returns "<not set>" for undefined value', () => {
    expect(maskSecret('MY_SECRET', undefined)).toBe('<not set>');
  });

  it('returns "<not set>" for empty string', () => {
    expect(maskSecret('MY_SECRET', '')).toBe('<not set>');
  });

  it('returns "****" for short values (4 or fewer chars)', () => {
    expect(maskSecret('MY_KEY', 'abc')).toBe('****');
    expect(maskSecret('MY_KEY', 'abcd')).toBe('****');
  });

  it('masks the majority of a long value', () => {
    const result = maskSecret('API_KEY', 'sk-abcdefghijklmnop12345');
    expect(result.startsWith('sk-')).toBe(true);
    expect(result.includes('*')).toBe(true);
    expect(result.length).toBe('sk-abcdefghijklmnop12345'.length);
  });

  it('shows only first few characters', () => {
    const result = maskSecret('TOKEN', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');
    expect(result.startsWith('eyJh')).toBe(true);
    expect(result.endsWith('*')).toBe(true);
    expect(result.includes('*')).toBe(true);
  });

  it('handles typical API key format', () => {
    const result = maskSecret('OPENAI_API_KEY', 'sk-proj-1234567890abcdefghij');
    expect(result.startsWith('sk-')).toBe(true);
    expect(result.includes('*')).toBe(true);
  });
});

describe('sanitizePath', () => {
  it('removes root prefix from path', () => {
    expect(sanitizePath('/home/user/project/src/index.ts', '/home/user/project')).toBe('src/index.ts');
  });

  it('removes leading slash', () => {
    expect(sanitizePath('/project/src/main.py', '/project')).toBe('src/main.py');
  });

  it('returns path unchanged if root is not prefix', () => {
    expect(sanitizePath('/other/path/file.ts', '/root/project')).toBe('other/path/file.ts');
  });

  it('handles paths with trailing slashes in root', () => {
    expect(sanitizePath('/home/user/project/src/app.ts', '/home/user/project/')).toBe('src/app.ts');
  });

  it('handles empty root', () => {
    expect(sanitizePath('/some/path', '')).toBe('some/path');
  });
});

describe('truncate', () => {
  it('returns text unchanged when within max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns text unchanged when exactly at max length', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });

  it('truncates and adds ellipsis when text exceeds max length', () => {
    expect(truncate('hello world this is long', 10)).toBe('hello w...');
  });

  it('handles very short max length', () => {
    expect(truncate('long text', 5)).toBe('lo...');
  });

  it('handles max length of 3 or less by just returning ellipsis', () => {
    const result = truncate('hello', 3);
    expect(result).toBe('...');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('handles maxLen of 0', () => {
    const result = truncate('test', 0);
    expect(result).toBe('t...');
  });
});

describe('safeStringify', () => {
  it('stringifies a simple object', () => {
    const obj = { name: 'shadow', version: '0.1.0' };
    const result = safeStringify(obj);
    expect(JSON.parse(result)).toEqual(obj);
  });

  it('stringifies a primitive value', () => {
    expect(safeStringify(42)).toBe('42');
    expect(safeStringify('hello')).toBe('"hello"');
  });

  it('stringifies an array', () => {
    expect(JSON.parse(safeStringify([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('handles circular references gracefully', () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const result = safeStringify(obj);
    expect(result).toBe('[object Object]');
  });

  it('returns string representation for non-serializable values', () => {
    expect(safeStringify(undefined)).toBe('undefined');
    const fnResult = safeStringify(function () {});
    expect(typeof fnResult).toBe('string');
    expect(fnResult).toContain('function');
  });

  it('pretty-prints with 2-space indentation', () => {
    const obj = { a: 1, b: { c: 2 } };
    const result = safeStringify(obj);
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });
});
