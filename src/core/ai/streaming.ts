import * as https from 'https';
import * as http from 'http';

interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class StreamingClient {
  static async streamSSE(
    response: { body: string },
    callbacks: StreamingCallbacks,
  ): Promise<string> {
    const lines = response.body.split('\n');
    let fullText = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = extractContent(parsed);
          if (content) {
            fullText += content;
            callbacks.onToken?.(content);
          }
        } catch {
          // skip unparseable lines
        }
      }
    }

    callbacks.onComplete?.(fullText);
    return fullText;
  }
}

function extractContent(parsed: { choices?: { delta?: { content?: string }; message?: { content?: string } }[] }): string {
  if (parsed.choices && parsed.choices.length > 0) {
    const choice = parsed.choices[0];
    if (choice.delta?.content) return choice.delta.content;
    if (choice.message?.content) return choice.message.content;
  }
  return '';
}

export interface StreamRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  callbacks: StreamingCallbacks;
}

export async function streamChatCompletion(
  url: string,
  body: unknown,
  apiKeyName: string,
  apiKey: string,
  callbacks: StreamingCallbacks,
): Promise<string> {

  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const transport = isHttps ? https : http;

  const bodyStr = JSON.stringify(body);

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(bodyStr),
      'Accept': 'text/event-stream',
      'User-Agent': 'shadow-cli/0.1',
    },
    timeout: 120000,
  };

  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res: import('http').IncomingMessage) => {
      const statusCode = res.statusCode;
      if (statusCode && statusCode >= 400) {
        reject(new Error(`HTTP ${statusCode}`));
        return;
      }

      let fullText = '';

      res.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        const lines = str.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = extractContent(parsed);
              if (content) {
                fullText += content;
                callbacks.onToken?.(content);
              }
            } catch {
              // skip unparseable lines
            }
          }
        }
      });

      const r = res as { on: (event: string, cb: (...args: unknown[]) => void) => void };
      r.on('end', () => {
        callbacks.onComplete?.(fullText);
        resolve(fullText);
      });

      r.on('error', (err: unknown) => {
        const error = err as Error;
        callbacks.onError?.(error);
        reject(error);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.on('error', (err: Error) => {
      callbacks.onError?.(err);
      reject(err);
    });

    req.write(bodyStr);
    req.end();
  });
}
