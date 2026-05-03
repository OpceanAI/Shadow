import { FileInfo } from '../types';
import { findFiles, readFile } from '../utils/fs';
import { Analyzer } from './analyzer';
import { ShadowConfig } from '../types';

export interface BatchOptions {
  batchSize?: number;
  maxMemoryMB?: number;
  onBatch?: (batchIndex: number, totalBatches: number, results: FileInfo[]) => void;
  onError?: (filePath: string, error: Error) => void;
}

export class BatchProcessor {
  private analyzer: Analyzer;
  private batchSize: number;
  private maxMemoryMB: number;

  constructor(config: ShadowConfig, options: BatchOptions = {}) {
    this.analyzer = new Analyzer(config);
    this.batchSize = options.batchSize || config.batchSize || 20;
    this.maxMemoryMB = options.maxMemoryMB || config.maxMemoryMB || 512;
  }

  async analyzeFiles(
    root: string,
    options: BatchOptions = {}
  ): Promise<FileInfo[]> {
    const patterns = [
      '*.py', '*.ts', '*.tsx', '*.js', '*.jsx', '*.rs', '*.go',
      '*.sh', '*.bash', '*.zsh', '*.java', '*.kt', '*.swift',
      '*.rb', '*.php', '*.scala', '*.ex', '*.exs', '*.hs',
      '*.cpp', '*.c', '*.hpp', '*.h', '*.sql', '*.tf',
    ];

    const allFiles = findFiles(root, patterns);
    const actualBatchSize = options.batchSize || this.batchSize;
    const batches = this.chunkArray(allFiles, actualBatchSize);
    const results: FileInfo[] = [];
    const onBatch = options.onBatch || (() => {});
    const onError = options.onError || ((file, err) => {
      process.stderr.write(`Error analyzing ${file}: ${err.message}\n`);
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (!this.checkMemory()) {
        if (global.gc) {
          global.gc();
        }
      }

      const batchResults: FileInfo[] = [];

      for (const file of batch) {
        try {
          const info = this.analyzer.analyzeFile(file, root);
          batchResults.push(info);
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError(file, error);
        }
      }

      results.push(...batchResults);
      onBatch(i, batches.length, batchResults);

      await this.yieldControl();
    }

    return results;
  }

  async analyzeFilesParallel(
    root: string,
    patterns: string[] = [],
    options: BatchOptions = {}
  ): Promise<FileInfo[]> {
    const defaultPatterns = [
      '*.py', '*.ts', '*.tsx', '*.js', '*.jsx', '*.rs', '*.go',
      '*.sh', '*.bash', '*.zsh', '*.java', '*.kt', '*.swift',
      '*.rb', '*.php', '*.scala', '*.ex', '*.exs', '*.hs',
      '*.cpp', '*.c', '*.hpp', '*.h', '*.sql', '*.tf',
    ];

    const patternsToUse = patterns.length > 0 ? patterns : defaultPatterns;
    const allFiles = findFiles(root, patternsToUse);
    const actualBatchSize = options.batchSize || this.batchSize;
    const batches = this.chunkArray(allFiles, actualBatchSize);
    const results: FileInfo[] = [];
    const onBatch = options.onBatch || (() => {});
    const onError = options.onError || ((file, err) => {
      process.stderr.write(`Error analyzing ${file}: ${err.message}\n`);
    });

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchPromises = batch.map(async (file) => {
        try {
          return this.analyzer.analyzeFile(file, root);
        } catch (err: unknown) {
          const error = err instanceof Error ? err : new Error(String(err));
          onError(file, error);
          return null;
        }
      });

      const batchResults = (await Promise.all(batchPromises)).filter((r): r is FileInfo => r !== null);
      results.push(...batchResults);
      onBatch(i, batches.length, batchResults);

      await this.yieldControl();
    }

    return results;
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  private checkMemory(): boolean {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / (1024 * 1024);
    return heapUsedMB < this.maxMemoryMB * 0.8;
  }

  private async yieldControl(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }
}

export function estimateMemoryUsage(files: string[]): number {
  const avgFileSize = 10 * 1024;
  const estimatedBytes = files.length * avgFileSize * 5;
  return estimatedBytes / (1024 * 1024);
}

export function suggestBatchSize(files: string[], maxMemoryMB: number = 512): number {
  const estimatedMB = estimateMemoryUsage(files);
  if (estimatedMB <= maxMemoryMB) return files.length;
  return Math.max(1, Math.floor((maxMemoryMB / estimatedMB) * files.length));
}
