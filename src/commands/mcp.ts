import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { TestGenerator } from '../core/test-gen';
import { readFile, findFiles } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as http from 'http';
import * as path from 'path';

export function mcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Start MCP (Model Context Protocol) server')
    .option('--port <n>', 'HTTP port', '4317')
    .option('--stdio', 'Use stdio transport instead of HTTP')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);

      if (options.stdio) {
        console.log(chalk.bold.blue('\n[shadow mcp] stdio mode\n'));
        console.log(chalk.dim('MCP stdio server started. Waiting for requests...'));

        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', async (data: string) => {
          try {
            const request = JSON.parse(data);
            const response = await handleMCPRequest(request, analyzer, config);
            process.stdout.write(JSON.stringify(response) + '\n');
          } catch {
            process.stdout.write(JSON.stringify({ error: 'Invalid request' }) + '\n');
          }
        });
        return;
      }

      const port = parseInt(options.port, 10);
      const server = http.createServer(async (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.method === 'POST' && req.url === '/mcp') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', async () => {
            try {
              const request = JSON.parse(body);
              const response = await handleMCPRequest(request, analyzer, config);
              res.writeHead(200);
              res.end(JSON.stringify(response));
            } catch {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
          });
          return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found. POST to /mcp' }));
      });

      server.listen(port, () => {
        if (options.json) {
          printJSON({ mcp: 'started', port, transport: 'http' });
          return;
        }
        console.log(chalk.bold.blue('\n[shadow mcp]\n'));
        console.log(chalk.green(`MCP server running on http://localhost:${port}/mcp`));
        console.log(chalk.dim(`\n  Available tools:`));
        console.log(chalk.dim(`    analyze_file  - Analyze a specific file`));
        console.log(chalk.dim(`    search_code   - Search codebase`));
        console.log(chalk.dim(`    get_graph     - Get dependency graph`));
        console.log(chalk.dim(`    run_tests     - Run tests`));
        console.log(chalk.dim(`\n  Connect from Claude/Cursor with:`));
        console.log(chalk.dim(`    POST http://localhost:${port}/mcp`));
        console.log('');
      });
    });
}

async function handleMCPRequest(
  request: { method?: string; params?: Record<string, unknown> },
  analyzer: Analyzer,
  config: ReturnType<typeof loadConfig>,
): Promise<Record<string, unknown>> {
  const method = request.method || '';
  const params = request.params || {};

  switch (method) {
    case 'tools/list': {
      return {
        tools: [
          {
            name: 'analyze_file',
            description: 'Analyze a specific file and return its structure',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
          },
          {
            name: 'search_code',
            description: 'Search the codebase for patterns',
            inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, type: { type: 'string' } } },
          },
          {
            name: 'get_graph',
            description: 'Get the project dependency graph',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'run_tests',
            description: 'Run the project tests',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      };
    }

    case 'tools/call': {
      const toolName = params.name as string;
      const toolArgs = (params.arguments as Record<string, unknown>) || {};

      switch (toolName) {
        case 'analyze_file': {
          const filePath = (toolArgs.path as string) || '';
          const info = analyzer.analyzeFile(filePath);
          return { content: [{ type: 'text', text: JSON.stringify(info, null, 2) }] };
        }
        case 'search_code': {
          const pattern = (toolArgs.pattern as string) || '';
          const type = (toolArgs.type as string) || 'all';
          const project = analyzer.analyzeProject();
          const results: string[] = [];
          for (const file of project.files) {
            if (type === 'all' || type === 'function') {
              file.functions.filter((f) => f.includes(pattern)).forEach((f) => {
                results.push(`[function] ${f} → ${file.path}`);
              });
            }
            if (type === 'all' || type === 'class') {
              file.classes.filter((c) => c.includes(pattern)).forEach((c) => {
                results.push(`[class] ${c} → ${file.path}`);
              });
            }
            if (type === 'all' || type === 'import') {
              file.imports.filter((i) => i.name.includes(pattern)).forEach((i) => {
                results.push(`[import] ${i.name} → ${file.path}`);
              });
            }
            if (type === 'all' || type === 'env') {
              file.envVars.filter((v) => v.includes(pattern)).forEach((v) => {
                results.push(`[env] ${v} → ${file.path}`);
              });
            }
          }
          return { content: [{ type: 'text', text: results.join('\n') || 'No results' }] };
        }
        case 'get_graph': {
          const project = analyzer.analyzeProject();
          return { content: [{ type: 'text', text: JSON.stringify(project.graph, null, 2) }] };
        }
        case 'run_tests': {
          const gen = new TestGenerator(config);
          const result = await gen.detectAndRun();
          return { content: [{ type: 'text', text: `${result.passed}/${result.total} passed, ${result.failed} failed` }] };
        }
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    }

    case 'initialize': {
      return {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'shadow-mcp', version: '0.1.0' },
      };
    }

    default:
      return { error: `Unknown method: ${method}` };
  }
}
