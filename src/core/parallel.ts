import { Worker } from 'worker_threads';
import * as os from 'os';
import * as path from 'path';

export interface ParallelTask<TInput, TOutput> {
  id: number;
  data: TInput;
}

export interface ParallelResult<TOutput> {
  id: number;
  result: TOutput;
  error?: string;
}

export interface ParallelOptions {
  maxWorkers?: number;
  taskTimeout?: number;
  showProgress?: boolean;
}

export class ParallelRunner<TInput, TOutput> {
  private maxWorkers: number;
  private taskTimeout: number;
  private showProgress: boolean;
  private pending: Array<ParallelTask<TInput, TOutput>>;
  private results: Map<number, ParallelResult<TOutput>>;
  private active: number;

  constructor(options: ParallelOptions = {}) {
    this.maxWorkers = options.maxWorkers || Math.max(1, os.cpus().length - 1);
    this.taskTimeout = options.taskTimeout || 30000;
    this.showProgress = options.showProgress || false;
    this.pending = [];
    this.results = new Map();
    this.active = 0;
  }

  async runAll(
    tasks: TInput[],
    worker: (input: TInput, id: number) => TOutput | Promise<TOutput>
  ): Promise<ParallelResult<TOutput>[]> {
    this.pending = tasks.map((data, i) => ({ id: i, data }));
    this.results.clear();
    this.active = 0;

    const queue = [...this.pending];
    const batches: Array<typeof queue> = [];

    while (queue.length > 0) {
      batches.push(queue.splice(0, this.maxWorkers));
    }

    for (const batch of batches) {
      const batchPromises = batch.map((task) =>
        this.runTask(task, worker)
      );
      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        this.results.set(result.id, result);
      }

      if (this.showProgress) {
        const done = this.results.size;
        const total = this.pending.length;
        const percent = Math.round((done / total) * 100);
        process.stderr.write(`\r  Progress: ${done}/${total} (${percent}%)`);
      }
    }

    if (this.showProgress) {
      process.stderr.write('\n');
    }

    return Array.from(this.results.values()).sort((a, b) => a.id - b.id);
  }

  private async runTask(
    task: ParallelTask<TInput, TOutput>,
    worker: (input: TInput, id: number) => TOutput | Promise<TOutput>
  ): Promise<ParallelResult<TOutput>> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Task ${task.id} timed out`)), this.taskTimeout)
      );

      const result = await Promise.race([
        Promise.resolve(worker(task.data, task.id)),
        timeoutPromise,
      ]);

      return { id: task.id, result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { id: task.id, result: null as unknown as TOutput, error: message };
    }
  }

  getResult(id: number): ParallelResult<TOutput> | undefined {
    return this.results.get(id);
  }
}

export function getOptimalWorkerCount(): number {
  return Math.max(1, os.cpus().length - 1);
}

export async function processBatch<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => TOutput | Promise<TOutput>,
  batchSize: number = 10
): Promise<TOutput[]> {
  const results: TOutput[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => Promise.resolve(processor(item)))
    );
    results.push(...batchResults);
  }

  return results;
}

export async function processWithLimit<TInput, TOutput>(
  items: TInput[],
  processor: (item: TInput) => TOutput | Promise<TOutput>,
  concurrency: number
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await Promise.resolve(processor(items[i]));
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
