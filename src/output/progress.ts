export class Spinner {
  private frames: string[];
  private interval: ReturnType<typeof setInterval> | null;
  private index: number;
  private message: string;
  private stream: NodeJS.WriteStream;

  constructor(message: string = 'Loading...') {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.index = 0;
    this.interval = null;
    this.message = message;
    this.stream = process.stderr;
  }

  start(): void {
    if (this.interval) return;
    this.stream.write('\u001B[?25l');
    this.interval = setInterval(() => {
      this.stream.write(`\r${this.frames[this.index]} ${this.message}`);
      this.index = (this.index + 1) % this.frames.length;
    }, 80);
  }

  update(message: string): void {
    this.message = message;
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.stream.write('\u001B[?25h');
      if (finalMessage) {
        this.stream.write(`\r${finalMessage}\n`);
      } else {
        this.stream.write('\r\u001B[K');
      }
    }
  }

  succeed(message?: string): void {
    this.stop(`✓ ${message || this.message}`);
  }

  fail(message?: string): void {
    this.stop(`✗ ${message || this.message}`);
  }

  warn(message?: string): void {
    this.stop(`⚠ ${message || this.message}`);
  }
}

export interface ProgressBarOptions {
  total: number;
  width?: number;
  description?: string;
  showPercent?: boolean;
  showCount?: boolean;
  showETA?: boolean;
  stream?: NodeJS.WriteStream;
}

export class ProgressBar {
  private total: number;
  private current: number;
  private width: number;
  private description: string;
  private showPercent: boolean;
  private showCount: boolean;
  private showETA: boolean;
  private stream: NodeJS.WriteStream;
  private startTime: number;
  private lastRenderTime: number;

  constructor(options: ProgressBarOptions) {
    this.total = options.total;
    this.current = 0;
    this.width = options.width || 30;
    this.description = options.description || '';
    this.showPercent = options.showPercent !== false;
    this.showCount = options.showCount !== false;
    this.showETA = options.showETA || false;
    this.stream = options.stream || process.stderr;
    this.startTime = Date.now();
    this.lastRenderTime = 0;
    this.render();
  }

  update(value: number): void {
    this.current = Math.min(value, this.total);
    this.render();
  }

  increment(delta: number = 1): void {
    this.current = Math.min(this.current + delta, this.total);
    this.render();
  }

  tick(): void {
    this.increment(1);
  }

  complete(message?: string): void {
    this.current = this.total;
    this.render();
    this.stream.write('\n');
    if (message) {
      this.stream.write(`${message}\n`);
    }
  }

  private render(): void {
    const now = Date.now();
    if (now - this.lastRenderTime < 50 && this.current < this.total) return;
    this.lastRenderTime = now;

    const percent = this.total > 0 ? this.current / this.total : 0;
    const filled = Math.round(this.width * percent);
    const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);

    let line = '\r';
    if (this.description) line += this.description + ' ';
    line += `[${bar}]`;

    if (this.showPercent) {
      line += ` ${Math.round(percent * 100)}%`;
    }
    if (this.showCount) {
      line += ` (${this.current}/${this.total})`;
    }
    if (this.showETA && this.current > 0) {
      const elapsed = (now - this.startTime) / 1000;
      const rate = this.current / elapsed;
      const remaining = (this.total - this.current) / rate;
      line += ` ETA: ${formatDuration(remaining)}`;
    }

    this.stream.write(line);
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function printStatus(level: 'info' | 'warn' | 'error' | 'success', message: string): void {
  const icons: Record<string, string> = {
    info: '\u001B[36mℹ\u001B[0m',
    warn: '\u001B[33m⚠\u001B[0m',
    error: '\u001B[31m✗\u001B[0m',
    success: '\u001B[32m✓\u001B[0m',
  };
  process.stderr.write(`${icons[level] || ''} ${message}\n`);
}

export function printStep(current: number, total: number, message: string): void {
  const pad = String(total).length;
  const num = String(current).padStart(pad, '0');
  process.stderr.write(`\u001B[36m[${num}/${total}]\u001B[0m ${message}\n`);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
