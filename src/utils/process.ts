import { execFileSync, spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export function runCommand(cmd: string, args: string[], cwd?: string): string {
  const result = execFileSync(cmd, args, {
    cwd: cwd || process.cwd(),
    encoding: 'utf-8',
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return result;
}

export function runCommandSafe(
  cmd: string,
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execErr.stdout?.toString() || '',
      stderr: execErr.stderr?.toString() || '',
      exitCode: execErr.status || 1,
    };
  }
}

export function spawnProcess(
  cmd: string,
  args: string[],
  cwd?: string,
): ChildProcess {
  const child = spawn(cmd, args, {
    cwd: cwd || process.cwd(),
    stdio: 'pipe',
    env: { ...process.env },
  });
  return child;
}

export function getRunningProcesses(): string[] {
  try {
    const output = execFileSync('ps', ['aux'], { encoding: 'utf-8' });
    return output.split('\n').slice(1).filter(Boolean);
  } catch {
    return [];
  }
}

export function pidIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
