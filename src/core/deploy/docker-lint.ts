import { readFile, fileExists } from '../../utils/fs';
import { DeployCheck } from '../../types';

export interface DockerLintResult {
  checks: DeployCheck[];
  score: number;
}

export function lintDockerfile(root: string): DockerLintResult {
  const checks: DeployCheck[] = [];
  const dockerfilePath = `${root}/Dockerfile`;
  const dockerignorePath = `${root}/.dockerignore`;

  if (!fileExists(dockerfilePath)) {
    return {
      checks: [{ name: 'Dockerfile', status: 'fail', message: 'Dockerfile not found' }],
      score: 0,
    };
  }

  const content = readFile(dockerfilePath);
  const lines = content.split('\n');

  checkUser(lines, checks);
  checkMultiStage(lines, checks);
  checkHealthcheck(lines, checks);
  checkDockerignore(root, dockerignorePath, checks);
  checkPackageLock(lines, checks);
  checkEntrypoint(lines, checks);
  checkExpose(lines, checks);
  checkLayerCaching(lines, checks);
  checkCopyAdd(lines, checks);

  const passed = checks.filter((c) => c.status === 'pass').length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return { checks, score };
}

function checkUser(lines: string[], checks: DeployCheck[]): void {
  const hasUser = lines.some((l) => /^\s*USER\s+/i.test(l));
  checks.push({
    name: 'Non-root user',
    status: hasUser ? 'pass' : 'fail',
    message: hasUser
      ? 'Container runs as non-root user'
      : 'USER directive missing — container runs as root',
  });
}

function checkMultiStage(lines: string[], checks: DeployCheck[]): void {
  const fromCount = lines.filter((l) => /^\s*FROM\s+/i.test(l)).length;
  const hasAlias = lines.some((l) => /^\s*FROM\s+\S+\s+AS\s+\S+/i.test(l));
  checks.push({
    name: 'Multi-stage build',
    status: fromCount > 1 && hasAlias ? 'pass' : 'warn',
    message:
      fromCount > 1 && hasAlias
        ? 'Dockerfile uses multi-stage build'
        : 'Consider using multi-stage builds to reduce image size',
  });
}

function checkHealthcheck(lines: string[], checks: DeployCheck[]): void {
  const hasHealthcheck = lines.some((l) => /^\s*HEALTHCHECK\s+/i.test(l));
  checks.push({
    name: 'Healthcheck',
    status: hasHealthcheck ? 'pass' : 'warn',
    message: hasHealthcheck
      ? 'HEALTHCHECK directive found'
      : 'No HEALTHCHECK — add one for better container orchestration',
  });
}

function checkDockerignore(
  root: string,
  dockerignorePath: string,
  checks: DeployCheck[],
): void {
  checks.push({
    name: '.dockerignore',
    status: fileExists(dockerignorePath) ? 'pass' : 'fail',
    message: fileExists(dockerignorePath)
      ? '.dockerignore present'
      : 'Missing .dockerignore — build context may be unnecessarily large',
  });
}

function checkPackageLock(lines: string[], checks: DeployCheck[]): void {
  const hasCopyPkg = lines.some(
    (l) =>
      /COPY\s+.*package(-lock)?\.json/i.test(l),
  );
  const hasNpmCi = lines.some((l) => /npm\s+ci/i.test(l));
  checks.push({
    name: 'Deterministic installs',
    status: hasCopyPkg && hasNpmCi ? 'pass' : 'warn',
    message:
      hasCopyPkg && hasNpmCi
        ? 'Uses npm ci with lockfile for deterministic builds'
        : 'Consider using npm ci and copying lockfile for reproducible builds',
  });
}

function checkEntrypoint(lines: string[], checks: DeployCheck[]): void {
  const hasEntrypoint = lines.some((l) => /^\s*ENTRYPOINT\s+/i.test(l));
  checks.push({
    name: 'ENTRYPOINT defined',
    status: hasEntrypoint ? 'pass' : 'warn',
    message: hasEntrypoint
      ? 'ENTRYPOINT is defined'
      : 'No ENTRYPOINT — consider defining one',
  });
}

function checkExpose(lines: string[], checks: DeployCheck[]): void {
  const hasExpose = lines.some((l) => /^\s*EXPOSE\s+/i.test(l));
  checks.push({
    name: 'Port exposure documented',
    status: hasExpose ? 'pass' : 'warn',
    message: hasExpose
      ? 'EXPOSE directive found'
      : 'No EXPOSE directive — document exposed ports',
  });
}

function checkLayerCaching(lines: string[], checks: DeployCheck[]): void {
  const copyLines = lines.filter((l) => /^\s*COPY\s+/i.test(l));
  const pkgCopyIdx = copyLines.findIndex((l) => /package.*json/i.test(l));
  const srcCopyIdx = copyLines.findIndex((l) => /src/i.test(l) || /COPY\s+\.\s+/i.test(l));

  const wellOrdered = pkgCopyIdx >= 0 && srcCopyIdx >= 0 && pkgCopyIdx < srcCopyIdx;
  checks.push({
    name: 'Layer caching optimized',
    status: wellOrdered ? 'pass' : 'warn',
    message: wellOrdered
      ? 'Package files copied before source code for optimal caching'
      : 'Copy package files before source for better layer caching',
  });
}

function checkCopyAdd(lines: string[], checks: DeployCheck[]): void {
  const hasAdd = lines.some((l) => /^\s*ADD\s+/i.test(l) && !l.includes('--chown'));
  checks.push({
    name: 'Prefer COPY over ADD',
    status: hasAdd ? 'warn' : 'pass',
    message: hasAdd
      ? 'ADD used without --chown; prefer COPY unless tar auto-extraction is needed'
      : 'Uses COPY (not ADD) as recommended',
  });
}
