import { readFile, fileExists, findFiles } from '../../utils/fs';
import { getEnvVarsFromCode, isSecretVar } from '../../utils/env';
import { DeployCheck } from '../../types';

export interface EnvCheckResult {
  checks: DeployCheck[];
  missing: string[];
  documented: string[];
  detected: string[];
}

export function checkEnvironmentVariables(
  root: string,
  requiredVars: string[],
): EnvCheckResult {
  const checks: DeployCheck[] = [];
  const missing: string[] = [];
  const documented: string[] = [];
  const detected: string[] = [];

  const envExample = parseEnvFile(`${root}/.env.example`);
  const envVars = parseEnvFile(`${root}/.env`);
  const codeEnvVars = detectEnvVarsFromCode(root);

  const allDocVars = new Set([...envExample.keys()]);
  for (const v of allDocVars) documented.push(v);
  for (const v of codeEnvVars) detected.push(v);

  for (const v of requiredVars) {
    if (!process.env[v] && !envVars.has(v)) {
      missing.push(v);
      checks.push({
        name: `Required env: ${v}`,
        status: 'fail',
        message: `Required environment variable "${v}" is not set`,
      });
    }
  }

  for (const v of codeEnvVars) {
    if (!envExample.has(v) && !requiredVars.includes(v)) {
      checks.push({
        name: `Undocumented env: ${v}`,
        status: 'warn',
        message: `"${v}" is used in code but not documented in .env.example`,
      });
    }
  }

  for (const [key, _value] of envExample) {
    if (isSecretVar(key)) {
      const isSet = !!process.env[key] || envVars.has(key);
      checks.push({
        name: `Secret var: ${key}`,
        status: isSet ? 'pass' : 'warn',
        message: isSet
          ? `Secret variable "${key}" is configured`
          : `Secret variable "${key}" is documented but may need to be set`,
      });
    }
  }

  if (!fileExists(`${root}/.env.example`)) {
    checks.push({
      name: '.env.example',
      status: 'warn',
      message:
        'No .env.example found — consider documenting required environment variables',
    });
  }

  if (checks.length === 0) {
    checks.push({
      name: 'Environment variables',
      status: 'pass',
      message: 'All environment variables are properly documented and configured',
    });
  }

  return { checks, missing, documented, detected };
}

function parseEnvFile(filePath: string): Map<string, string> {
  const vars = new Map<string, string>();
  if (!fileExists(filePath)) return vars;

  try {
    const content = readFile(filePath);
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();
      if (key) vars.set(key, value);
    }
  } catch {
    // Ignore parse errors
  }

  return vars;
}

function detectEnvVarsFromCode(root: string): string[] {
  const allVars = new Set<string>();
  const codeFiles = [
    ...findFiles(root, ['*.ts']),
    ...findFiles(root, ['*.js']),
    ...findFiles(root, ['*.py']),
    ...findFiles(root, ['*.go']),
    ...findFiles(root, ['*.rs']),
    ...findFiles(root, ['*.sh']),
  ];

  for (const file of codeFiles) {
    try {
      const content = readFile(file);
      const vars = getEnvVarsFromCode(content);
      for (const v of vars) allVars.add(v);
    } catch {
      // Skip unreadable files
    }
  }

  return Array.from(allVars).sort();
}
