import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { FileInfo } from '../types';
import { fileExists, readFile, writeFile, readJSON } from '../utils/fs';

export interface CacheEntry {
  filePath: string;
  hash: string;
  info: FileInfo;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entryCount: number;
}

export class AnalysisCache {
  private cacheDir: string;
  private maxSize: number;
  private entries: Map<string, CacheEntry>;
  private hits: number;
  private misses: number;
  private dirty: boolean;

  constructor(cacheDir: string = path.join(process.cwd(), '.shadow', 'cache'), maxSize: number = 500) {
    this.cacheDir = cacheDir;
    this.maxSize = maxSize;
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
    this.dirty = false;
    this.load();
  }

  get(filePath: string, content: string): FileInfo | null {
    const hash = this.computeHash(content);
    const entry = this.entries.get(filePath);

    if (entry && entry.hash === hash) {
      this.hits++;
      entry.timestamp = Date.now();
      return entry.info;
    }

    this.misses++;
    return null;
  }

  set(filePath: string, content: string, info: FileInfo): void {
    const hash = this.computeHash(content);
    const entry: CacheEntry = {
      filePath,
      hash,
      info,
      timestamp: Date.now(),
    };

    this.entries.set(filePath, entry);
    this.dirty = true;

    if (this.entries.size > this.maxSize) {
      this.evict();
    }
  }

  has(filePath: string, content: string): boolean {
    const hash = this.computeHash(content);
    const entry = this.entries.get(filePath);
    return entry !== undefined && entry.hash === hash;
  }

  invalidate(filePath: string): void {
    this.entries.delete(filePath);
    this.dirty = true;
  }

  clear(): void {
    this.entries.clear();
    this.hits = 0;
    this.misses = 0;
    this.dirty = true;
    this.save();
  }

  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.entries.size,
      entryCount: this.entries.size,
    };
  }

  hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  save(): void {
    if (!this.dirty && this.entries.size === 0) return;

    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const indexFile = path.join(this.cacheDir, 'index.json');
      const index: { files: Record<string, CacheEntry> } = {
        files: Object.fromEntries(this.entries),
      };

      fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf-8');
      this.dirty = false;
    } catch (err) {
      console.warn(chalk.yellow(`Warning: could not write analysis cache: ${(err as Error).message}`));
    }
  }

  load(): void {
    const indexFile = path.join(this.cacheDir, 'index.json');
    if (!fileExists(indexFile)) return;

    try {
      const data = readJSON<{ files: Record<string, CacheEntry> }>(indexFile);
      if (data.files) {
        for (const [key, entry] of Object.entries(data.files)) {
          this.entries.set(key, entry);
        }
      }
    } catch {
      // Cache load failure is non-fatal
    }
  }

  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private evict(): void {
    const sorted = Array.from(this.entries.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const toRemove = Math.ceil(this.entries.size * 0.2);
    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.entries.delete(sorted[i][0]);
    }
  }
}

export function computeFileHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function computeFileHashFromPath(filePath: string): string {
  const content = readFile(filePath);
  return computeFileHash(content);
}

export function cacheKey(filePath: string, content: string): string {
  return `${filePath}:${computeFileHash(content)}`;
}
