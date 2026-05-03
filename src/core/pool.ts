import * as http from 'http';
import * as https from 'https';

export interface ConnectionPoolOptions {
  maxConnections?: number;
  maxIdleTime?: number;
  keepAlive?: boolean;
  timeout?: number;
}

interface PooledConnection {
  id: number;
  inUse: boolean;
  lastUsed: number;
  agent: http.Agent | https.Agent;
}

export interface PoolRequestOptions extends http.RequestOptions {
  body?: string;
}

export class ConnectionPool {
  private connections: Map<number, PooledConnection>;
  private maxConnections: number;
  private maxIdleTime: number;
  private timeout: number;
  private nextId: number;
  private stats: { created: number; reused: number; closed: number; errors: number };

  constructor(options: ConnectionPoolOptions = {}) {
    this.connections = new Map();
    this.maxConnections = options.maxConnections || 10;
    this.maxIdleTime = options.maxIdleTime || 60000;
    this.timeout = options.timeout || 30000;
    this.nextId = 1;
    this.stats = { created: 0, reused: 0, closed: 0, errors: 0 };

    setInterval(() => this.cleanup(), this.maxIdleTime / 2);
  }

  async request(
    url: string,
    options: PoolRequestOptions = {}
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';

    const requestOptions: http.RequestOptions = {
      hostname: parsed.hostname || 'localhost',
      port: parseInt(parsed.port, 10) || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: this.timeout,
      agent: this.getAgent(isHttps),
    };

    return new Promise((resolve, reject) => {
      const transport = isHttps ? https : http;
      const req = transport.request(requestOptions, (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, headers: res.headers, body });
        });
      });

      req.on('error', (err: Error) => {
        this.stats.errors++;
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        this.stats.errors++;
        reject(new Error(`Request timed out after ${this.timeout}ms`));
      });

      if (options.method !== 'GET' && options.method !== 'HEAD' && options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  async get(url: string, headers?: Record<string, string>): Promise<{ status: number; body: string }> {
    return this.request(url, { method: 'GET', headers });
  }

  async post(
    url: string,
    body: string,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: string }> {
    return this.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  }

  private getAgent(isHttps: boolean): http.Agent | https.Agent {
    const available = Array.from(this.connections.entries()).find(
      ([, conn]) => !conn.inUse && conn.agent instanceof (isHttps ? https.Agent : http.Agent)
    );

    if (available) {
      this.stats.reused++;
      const conn = available[1];
      conn.inUse = true;
      conn.lastUsed = Date.now();
      return conn.agent;
    }

    if (this.connections.size < this.maxConnections) {
      const id = this.nextId++;
      const agent = isHttps
        ? new https.Agent({ keepAlive: true, maxSockets: 1, timeout: this.timeout })
        : new http.Agent({ keepAlive: true, maxSockets: 1, timeout: this.timeout });

      this.connections.set(id, {
        id,
        inUse: true,
        lastUsed: Date.now(),
        agent,
      });

      this.stats.created++;
      return agent;
    }

    const recycled = Array.from(this.connections.entries()).find(
      ([, conn]) => !conn.inUse
    );

    if (recycled) {
      this.stats.reused++;
      const conn = recycled[1];
      conn.inUse = true;
      conn.lastUsed = Date.now();
      return conn.agent;
    }

    this.stats.created++;
    return isHttps
      ? new https.Agent({ keepAlive: true, maxSockets: 1, timeout: this.timeout })
      : new http.Agent({ keepAlive: true, maxSockets: 1, timeout: this.timeout });
  }

  release(agent: http.Agent | https.Agent): void {
    for (const [, conn] of this.connections) {
      if (conn.agent === agent) {
        conn.inUse = false;
        break;
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, conn] of this.connections) {
      if (!conn.inUse && now - conn.lastUsed > this.maxIdleTime) {
        conn.agent.destroy();
        this.connections.delete(id);
        this.stats.closed++;
      }
    }
  }

  getStats() {
    return { ...this.stats, active: this.connections.size };
  }

  close(): void {
    for (const [, conn] of this.connections) {
      conn.agent.destroy();
    }
    this.connections.clear();
  }
}
