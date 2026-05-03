import { ChildProcess } from 'child_process';
import { TraceEvent, TraceDomain, TraceResult } from '../types';
import { spawnProcess } from '../utils/process';
import { fileExists } from '../utils/fs';
import { isSecretVar } from '../utils/env';

export class Tracer {
  private domains: TraceDomain[];
  private timeout: number;

  constructor(domains: TraceDomain[] = ['all'], timeout: number = 30000) {
    this.domains = domains;
    this.timeout = timeout;
  }

  traceCommand(cmd: string, args: string[]): Promise<TraceResult> {
    const events: TraceEvent[] = [];
    const errors: string[] = [];
    const startTime = Date.now();

    const child = spawnProcess(cmd, args);
    const envClone = { ...process.env };

    const isActive = (d: TraceDomain): boolean =>
      this.domains.includes('all') || this.domains.includes(d);

    if (isActive('env')) {
      for (const [key, value] of Object.entries(envClone)) {
        events.push({
          timestamp: Date.now(),
          type: 'env',
          detail: `env var ${key}`,
          value: isSecretVar(key) ? '***MASKED***' : value,
          masked: isSecretVar(key),
        });
      }
    }

    if (isActive('fs') && child.pid) {
      events.push({
        timestamp: Date.now(),
        type: 'fs',
        detail: `Process started with PID ${child.pid}`,
      });
    }

    child.stdout?.on('data', (data: Buffer) => {
      events.push({
        timestamp: Date.now(),
        type: isActive('network') ? 'network' : 'fs',
        detail: data.toString().trim(),
      });
    });

    child.stderr?.on('data', (data: Buffer) => {
      const errStr = data.toString().trim();
      errors.push(errStr);
      events.push({
        timestamp: Date.now(),
        type: 'fs',
        detail: `stderr: ${errStr}`,
      });
    });

    return new Promise((resolve) => {
      child.on('close', (code) => {
        resolve({
          events,
          duration: Date.now() - startTime,
          exitCode: code,
          errors,
        });
      });

      child.on('error', (err) => {
        errors.push(err.message);
        resolve({
          events,
          duration: Date.now() - startTime,
          exitCode: 1,
          errors,
        });
      });

      setTimeout(() => {
        if (!child.killed) {
          child.kill();
        }
        errors.push(`Trace timed out after ${this.timeout / 1000}s`);
        resolve({
          events,
          duration: Date.now() - startTime,
          exitCode: -1,
          errors,
        });
      }, this.timeout);
    });
  }

  async traceFile(filePath: string): Promise<TraceResult> {
    if (!fileExists(filePath)) {
      return {
        events: [],
        duration: 0,
        exitCode: 1,
        errors: [`File not found: ${filePath}`],
      };
    }

    const ext = filePath.split('.').pop();
    let cmd: string;
    const args: string[] = [filePath];

    switch (ext) {
      case 'py':
        cmd = 'python';
        break;
      case 'js':
      case 'mjs':
        cmd = 'node';
        break;
      case 'ts':
        cmd = 'npx';
        args.unshift('ts-node');
        break;
      case 'sh':
        cmd = 'bash';
        break;
      default:
        return {
          events: [],
          duration: 0,
          exitCode: 1,
          errors: [`Unsupported file type: .${ext}`],
        };
    }

    return this.traceCommand(cmd, args);
  }
}
