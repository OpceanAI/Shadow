import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { TestGenerator } from '../core/test-gen';
import { loadConfig } from '../core/config';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as http from 'http';

export function serverCommand(program: Command): void {
  program
    .command('server')
    .description('HTTP API mode for shadow')
    .option('--port <n>', 'Port to listen on', '4321')
    .option('--host <addr>', 'Host to bind to', '127.0.0.1')
    .option('--cors', 'Enable CORS for all origins')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const port = parseInt(options.port, 10);
      const host = options.host || '127.0.0.1';

      const server = http.createServer(async (req, res) => {
        const corsOrigin = options.cors ? '*' : '';

        res.setHeader('Content-Type', 'application/json');
        if (corsOrigin) {
          res.setHeader('Access-Control-Allow-Origin', corsOrigin);
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://${host}:${port}`);
        const path = url.pathname;

        try {
          if (req.method === 'GET' && path === '/info') {
            const project = analyzer.analyzeProject();
            res.writeHead(200);
            res.end(printJSONRaw(project));
          } else if (req.method === 'GET' && path === '/health') {
            const project = analyzer.analyzeProject();
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok', project: project.name }));
          } else if (req.method === 'POST' && path === '/analyze') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const { target } = JSON.parse(body);
                if (target) {
                  const info = analyzer.analyzeFile(target);
                  res.writeHead(200);
                  res.end(printJSONRaw(info));
                } else {
                  const project = analyzer.analyzeProject();
                  res.writeHead(200);
                  res.end(printJSONRaw(project));
                }
              } catch {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request body' }));
              }
            });
          } else if (req.method === 'POST' && path === '/fix') {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
              try {
                const { issue } = JSON.parse(body);
                res.writeHead(200);
                res.end(JSON.stringify({
                  issue: issue || 'general',
                  suggestion: 'Run shadow fix --issue "' + (issue || 'general') + '" for details',
                }));
              } catch {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request body' }));
              }
            });
          } else if (req.method === 'POST' && path === '/test') {
            const gen = new TestGenerator(config);
            const result = await gen.detectAndRun();
            res.writeHead(200);
            res.end(printJSONRaw(result));
          } else if (req.method === 'GET' && path === '/graph') {
            const project = analyzer.analyzeProject();
            res.writeHead(200);
            res.end(JSON.stringify(project.graph));
          } else {
            res.writeHead(404);
            res.end(JSON.stringify({
              error: 'Not found',
              endpoints: ['GET /info', 'GET /health', 'POST /analyze', 'POST /fix', 'POST /test', 'GET /graph'],
            }));
          }
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error', message: err instanceof Error ? err.message : 'Unknown' }));
        }
      });

      server.listen(port, host, () => {
        console.log(chalk.bold.blue('\n[shadow server]\n'));
        console.log(chalk.green(`HTTP API running on http://${host}:${port}`));
        console.log(chalk.dim('\n  Endpoints:'));
        console.log(chalk.dim('    GET  /info          Project information'));
        console.log(chalk.dim('    GET  /health        Health check'));
        console.log(chalk.dim('    POST /analyze       Analyze project/file'));
        console.log(chalk.dim('    POST /fix           Get fix suggestions'));
        console.log(chalk.dim('    POST /test          Run tests'));
        console.log(chalk.dim('    GET  /graph         Dependency graph'));
        if (options.cors) {
          console.log(chalk.dim('    CORS: enabled for all origins'));
        }
        console.log('');
      });
    });
}

function printJSONRaw(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
