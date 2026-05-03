import * as https from 'https';
import * as http from 'http';

export interface HttpClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

const defaultHttpConfig: HttpClientOptions = {
  timeout: 120000,
  retries: 3,
  retryDelay: 1000,
};

export class HttpClient {
  private config: HttpClientOptions;

  constructor(config: Partial<HttpClientOptions> = {}) {
    this.config = { ...defaultHttpConfig, ...config };
  }

  async post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<HttpResponse> {
    return this.requestWithRetry('POST', url, body, headers, defaultRetryConfig);
  }

  async get(url: string, headers: Record<string, string> = {}): Promise<HttpResponse> {
    return this.requestWithRetry('GET', url, null, headers, defaultRetryConfig);
  }

  async postStream(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
    onChunk?: (chunk: string) => void,
  ): Promise<HttpResponse> {
    return this.request('POST', url, body, headers, onChunk);
  }

  private async requestWithRetry(
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
    retryConfig: RetryConfig,
    attempt: number = 1,
  ): Promise<HttpResponse> {
    try {
      return await this.request(method, url, body, headers);
    } catch (error: unknown) {
      const err = error as Error & { statusCode?: number; retryable?: boolean };

      const statusCode = err.statusCode || 0;
      const isRetryable =
        statusCode === 429 ||
        statusCode === 502 ||
        statusCode === 503 ||
        statusCode === 504 ||
        statusCode >= 500;

      if (attempt < retryConfig.maxRetries && isRetryable) {
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelay,
        );
        await sleep(delay);
        return this.requestWithRetry(method, url, body, headers, retryConfig, attempt + 1);
      }

      throw error;
    }
  }

  private request(
    method: string,
    url: string,
    body: unknown,
    headers: Record<string, string>,
    onChunk?: (chunk: string) => void,
  ): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const transport = isHttps ? https : http;

      const allHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'shadow-cli/0.1',
        ...this.config.headers,
        ...headers,
      };

      const options: https.RequestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers: allHeaders,
        timeout: this.config.timeout,
      };

      const req = transport.request(options, (res) => {
        let data = '';

        if (onChunk) {
          res.on('data', (chunk: Buffer) => {
            const str = chunk.toString();
            onChunk(str);
          });
        } else {
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
        }

        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) responseHeaders[k] = Array.isArray(v) ? v[0] : v;
          }

          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, headers: responseHeaders, body: data });
          } else if (res.statusCode && res.statusCode >= 400 && res.statusCode < 500 && res.statusCode !== 429) {
            reject(
              Object.assign(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`), {
                statusCode: res.statusCode,
                retryable: false,
              }),
            );
          } else {
            reject(
              Object.assign(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`), {
                statusCode: res.statusCode,
                retryable: true,
              }),
            );
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(
          Object.assign(new Error('Request timed out'), { statusCode: 408, retryable: true }),
        );
      });

      req.on('error', (err) => {
        reject(
          Object.assign(err, {
            statusCode: 0,
            retryable: true,
          }),
        );
      });

      if (body && method !== 'GET') {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sharedClient = new HttpClient();
