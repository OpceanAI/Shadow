import { describe, it, expect } from 'vitest';
import { getEnvVarsFromCode, isSecretVar } from '../../utils/env';

describe('getEnvVarsFromCode', () => {
  describe('Python patterns', () => {
    it('detects os.environ[]', () => {
      const code = `key = os.environ["MY_SECRET"]`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('MY_SECRET');
    });

    it('detects os.environ.get()', () => {
      const code = `key = os.environ.get("AWS_KEY", "default")`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('AWS_KEY');
    });

    it('detects os.getenv()', () => {
      const code = `db = os.getenv("DATABASE_URL")`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DATABASE_URL');
    });

    it('detects multiple env vars in Python', () => {
      const code = `
import os
API_KEY = os.environ.get("API_KEY")
DB_URL = os.environ["DATABASE_URL"]
DEBUG = os.getenv("DEBUG_MODE")
      `;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('API_KEY');
      expect(vars).toContain('DATABASE_URL');
      expect(vars).toContain('DEBUG_MODE');
    });
  });

  describe('JS/TS patterns', () => {
    it('detects process.env.VAR', () => {
      const code = `const apiKey = process.env.API_KEY;`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('API_KEY');
    });

    it('detects process.env["VAR"]', () => {
      const code = `const db = process.env["DATABASE_URL"];`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DATABASE_URL');
    });

    it('detects multiple env vars in JS', () => {
      const code = `
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV;
const SECRET = process.env["JWT_SECRET"];
      `;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('PORT');
      expect(vars).toContain('NODE_ENV');
      expect(vars).toContain('JWT_SECRET');
    });

    it('detects env with template strings', () => {
      const code = 'const token = `Bearer ${process.env.API_TOKEN}`;';
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('API_TOKEN');
    });
  });

  describe('Go patterns', () => {
    it('detects os.Getenv()', () => {
      const code = `dbHost := os.Getenv("DB_HOST")`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DB_HOST');
    });

    it('detects multiple Go env vars', () => {
      const code = `
dbHost := os.Getenv("DB_HOST")
port := os.Getenv("PORT")
      `;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DB_HOST');
      expect(vars).toContain('PORT');
    });
  });

  describe('Rust patterns', () => {
    it('detects env::var()', () => {
      const code = `let db = env::var("DATABASE_URL").unwrap();`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DATABASE_URL');
    });

    it('detects env::var_os()', () => {
      const code = `let path = env::var_os("DATA_PATH");`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('DATA_PATH');
    });
  });

  describe('Shell patterns', () => {
    it('detects ${VAR}', () => {
      const code = 'echo ${HOME}';
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('HOME');
    });

    it('detects config() calls', () => {
      const code = `val = config("MY_VAR", "default")`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).toContain('MY_VAR');
    });
  });

  describe('deduplication and filtering', () => {
    it('deduplicates duplicate references', () => {
      const code = `
const a = process.env.API_KEY;
const b = process.env.API_KEY;
      `;
      const vars = getEnvVarsFromCode(code);
      const keyCount = vars.filter(v => v === 'API_KEY').length;
      expect(keyCount).toBe(1);
    });

    it('filters out common keywords', () => {
      const code = `
const a = process.env.true;
const b = process.env.false;
const c = process.env.null;
      `;
      const vars = getEnvVarsFromCode(code);
      expect(vars).not.toContain('true');
      expect(vars).not.toContain('false');
      expect(vars).not.toContain('null');
    });

    it('filters single-character vars', () => {
      const code = `${'$'}{A}`;
      const vars = getEnvVarsFromCode(code);
      expect(vars).not.toContain('A');
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty code', () => {
      const vars = getEnvVarsFromCode('');
      expect(vars).toEqual([]);
    });

    it('returns empty array for code without env vars', () => {
      const vars = getEnvVarsFromCode('console.log("hello");');
      expect(vars).toEqual([]);
    });
  });
});

describe('isSecretVar', () => {
  it('detects names containing "key"', () => {
    expect(isSecretVar('API_KEY')).toBe(true);
    expect(isSecretVar('MY_KEY')).toBe(true);
    expect(isSecretVar('ENCRYPTION_KEY')).toBe(true);
  });

  it('detects names containing "secret"', () => {
    expect(isSecretVar('SECRET_TOKEN')).toBe(true);
    expect(isSecretVar('JWT_SECRET')).toBe(true);
    expect(isSecretVar('CLIENT_SECRET')).toBe(true);
  });

  it('detects names containing "token"', () => {
    expect(isSecretVar('ACCESS_TOKEN')).toBe(true);
    expect(isSecretVar('REFRESH_TOKEN')).toBe(true);
  });

  it('detects names containing "password"', () => {
    expect(isSecretVar('DB_PASSWORD')).toBe(true);
    expect(isSecretVar('ADMIN_PASSWORD')).toBe(true);
  });

  it('detects names containing "credential"', () => {
    expect(isSecretVar('AWS_CREDENTIALS')).toBe(true);
    expect(isSecretVar('GOOGLE_CREDENTIALS')).toBe(true);
  });

  it('detects names containing "auth"', () => {
    expect(isSecretVar('AUTH_TOKEN')).toBe(true);
    expect(isSecretVar('AUTHORIZATION')).toBe(true);
  });

  it('detects names containing "api_key" case-insensitively', () => {
    expect(isSecretVar('OPENAI_API_KEY')).toBe(true);
    expect(isSecretVar('api_key')).toBe(true);
  });

  it('detects names containing "private"', () => {
    expect(isSecretVar('PRIVATE_KEY')).toBe(true);
    expect(isSecretVar('SSH_PRIVATE_KEY')).toBe(true);
  });

  it('returns false for non-sensitive names', () => {
    expect(isSecretVar('PORT')).toBe(false);
    expect(isSecretVar('DATABASE_URL')).toBe(false);
    expect(isSecretVar('LOG_LEVEL')).toBe(false);
    expect(isSecretVar('HOST')).toBe(false);
    expect(isSecretVar('NODE_ENV')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSecretVar('')).toBe(false);
  });
});
