import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

interface CacheEntry {
  input: string;
  response: unknown;
  timestamp: number;
  ttl: number;
}

export class AICache {
  private cacheDir: string;
  private memoryCache: Map<string, CacheEntry>;
  private defaultTTL: number;

  constructor(cacheDir?: string, defaultTTL: number = 3600000) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.shadow', 'ai-cache');
    this.memoryCache = new Map();
    this.defaultTTL = defaultTTL;
  }

  private hash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
  }

  get(input: string): unknown | null {
    const key = this.hash(input);

    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < memEntry.ttl) {
        return memEntry.response;
      }
      this.memoryCache.delete(key);
    }

    const diskEntry = this.readFromDisk(key);
    if (diskEntry) {
      if (Date.now() - diskEntry.timestamp < diskEntry.ttl) {
        this.memoryCache.set(key, diskEntry);
        return diskEntry.response;
      }
      this.deleteFromDisk(key);
    }

    return null;
  }

  set(input: string, response: unknown, ttl?: number): void {
    const key = this.hash(input);
    const entry: CacheEntry = {
      input,
      response,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };

    this.memoryCache.set(key, entry);
    this.writeToDisk(key, entry);
  }

  clear(): void {
    this.memoryCache.clear();
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    } catch (err) {
      console.warn(chalk.yellow(`Warning: could not clear AI cache: ${(err as Error).message}`));
    }
  }

  has(input: string): boolean {
    return this.get(input) !== null;
  }

  private readFromDisk(key: string): CacheEntry | null {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as CacheEntry;
      }
    } catch (err) {
      console.warn(chalk.yellow(`Warning: could not read AI cache file: ${(err as Error).message}`));
    }
    return null;
  }

  private writeToDisk(key: string, entry: CacheEntry): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const filePath = path.join(this.cacheDir, `${key}.json`);
      fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8');
    } catch (err) {
      console.warn(chalk.yellow(`Warning: could not write AI cache file: ${(err as Error).message}`));
    }
  }

  private deleteFromDisk(key: string): void {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.warn(chalk.yellow(`Warning: could not delete AI cache file: ${(err as Error).message}`));
    }
  }
}

export const globalCache = new AICache();
