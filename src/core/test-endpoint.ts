import { TestFailure } from '../types';

export interface EndpointResult {
  url: string;
  method: string;
  statusCode: number;
  passed: boolean;
  responseTime: number;
  error?: string;
  bodyPreview?: string;
  headers?: Record<string, string>;
}

export class EndpointTester {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl: string, timeout: number = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async testEndpoint(url: string, method: string = 'GET', body?: unknown): Promise<EndpointResult> {
    const start = Date.now();
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      };

      if (body && method !== 'GET' && method !== 'HEAD') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(fullUrl, options);
      clearTimeout(timer);

      const responseTime = Date.now() - start;
      const statusCode = response.status;
      const headers: Record<string, string> = {};
      response.headers.forEach((v, k) => { headers[k] = v; });

      let bodyPreview = '';
      try {
        const text = await response.text();
        bodyPreview = text.slice(0, 500);
      } catch {
        bodyPreview = '[unable to read body]';
      }

      const passed = statusCode >= 200 && statusCode < 500;

      return {
        url: fullUrl,
        method,
        statusCode,
        passed,
        responseTime,
        bodyPreview,
        headers,
      };
    } catch (err) {
      return {
        url: fullUrl,
        method,
        statusCode: 0,
        passed: false,
        responseTime: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async testEndpoints(endpoints: Array<{ url: string; method: string; body?: unknown }>): Promise<EndpointResult[]> {
    const results: EndpointResult[] = [];
    for (const ep of endpoints) {
      results.push(await this.testEndpoint(ep.url, ep.method, ep.body));
    }
    return results;
  }

  async detectAndTest(endpoints: string[]): Promise<{ results: EndpointResult[]; failures: TestFailure[] }> {
    const results: EndpointResult[] = [];
    const failures: TestFailure[] = [];

    for (const ep of endpoints) {
      const parts = ep.split(' ');
      const method = parts.length > 1 ? parts[0] : 'GET';
      const url = parts.length > 1 ? parts[1] : parts[0];

      const result = await this.testEndpoint(url, method);
      results.push(result);

      if (!result.passed) {
        failures.push({
          name: `${method} ${url}`,
          error: result.error || `HTTP ${result.statusCode}`,
          file: url,
          line: 0,
        });
      }
    }

    return { results, failures };
  }

  async testWithInvalidInputs(url: string, method: string = 'POST'): Promise<EndpointResult[]> {
    const invalidInputs: unknown[] = [
      null,
      undefined,
      '',
      0,
      [],
      {},
      { $gt: '' },
      '<script>alert(1)</script>',
      "' OR '1'='1",
      { __proto__: { admin: true } },
      Array(10000).fill('A'),
      { '': '' },
      { '\x00': '\x00' },
    ];

    const results: EndpointResult[] = [];
    for (const input of invalidInputs) {
      const body = method !== 'GET' && method !== 'HEAD' ? input : undefined;
      results.push(await this.testEndpoint(url, method, body));
    }

    return results;
  }

  async smokeTest(endpoint: string): Promise<boolean> {
    const result = await this.testEndpoint(endpoint, 'GET');
    return result.passed;
  }

  async healthCheck(): Promise<{ healthy: boolean; results: EndpointResult[] }> {
    const healthEndpoints = ['/health', '/healthz', '/status', '/ping', '/api/health'];
    const results: EndpointResult[] = [];

    for (const ep of healthEndpoints) {
      const result = await this.testEndpoint(ep, 'GET');
      results.push(result);
      if (result.statusCode >= 200 && result.statusCode < 400) {
        return { healthy: true, results };
      }
    }

    return { healthy: false, results };
  }

  async detect500Errors(endpoints: string[]): Promise<EndpointResult[]> {
    const results: EndpointResult[] = [];
    for (const ep of endpoints) {
      const parts = ep.split(' ');
      const method = parts.length > 1 ? parts[0] : 'GET';
      const url = parts.length > 1 ? parts[1] : parts[0];

      const result = await this.testEndpoint(url, method);
      if (result.statusCode >= 500) {
        results.push(result);
      }
    }
    return results;
  }
}
