import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { TestGenerator } from '../core/test-gen';
import { AIProviderService } from '../core/ai-provider';
import { loadConfig } from '../core/config';
import { readFile, fileExists } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs';

export function replCommand(program: Command): void {
  program
    .command('repl')
    .description('Interactive REPL mode')
    .option('--provider <name>', 'AI provider for explain/fix commands')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);

      console.log(chalk.bold.blue('\n[shadow repl]\n'));
      console.log(chalk.dim('Type /help for available commands, /quit to exit.\n'));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('shadow> '),
        historySize: 100,
      });

      const history: string[] = [];
      rl.prompt();

      rl.on('line', async (input: string) => {
        const line = input.trim();
        if (line) history.push(line);

        try {
          if (line === '' || line.startsWith('#')) {
            // ignore
          } else if (line === '/quit' || line === '/q' || line === '/exit') {
            console.log(chalk.dim('Goodbye!'));
            rl.close();
            return;
          } else if (line === '/clear') {
            console.clear();
          } else if (line === '/help' || line === '/h') {
            showHelp();
          } else if (line === '/history') {
            history.forEach((h, i) => console.log(`  ${chalk.dim(String(i))} ${h}`));
          } else if (line === '/info') {
            const project = analyzer.analyzeProject();
            console.log(chalk.bold(`\n${project.name}`));
            console.log(chalk.dim(`${project.summary}`));
            console.log(`  Files: ${project.totalFiles}`);
            console.log(`  Language: ${project.language}`);
            console.log(`  Entry points: ${project.entryPoints.length}`);
            console.log(`  Env vars: ${project.envVars.length}`);
            console.log(`  External APIs: ${project.externalAPIs.length}`);
            console.log('');
          } else if (line.startsWith('/file ') || line.startsWith('/f ')) {
            const filePath = line.slice(line.indexOf(' ') + 1).trim();
            if (fileExists(filePath)) {
              const info = analyzer.analyzeFile(filePath);
              console.log(chalk.bold(`\n${info.path}`));
              console.log(`  Language: ${info.language}`);
              console.log(`  Functions: ${info.functions.join(', ') || 'none'}`);
              console.log(`  Classes: ${info.classes.join(', ') || 'none'}`);
              console.log(`  Imports: ${info.imports.map((i) => i.name).join(', ') || 'none'}`);
              console.log(`  Env vars: ${info.envVars.join(', ') || 'none'}`);
              console.log('');
            } else {
              console.log(chalk.red(`File not found: ${filePath}`));
            }
          } else if (line.startsWith('/cat ') || line.startsWith('/c ')) {
            const filePath = line.slice(line.indexOf(' ') + 1).trim();
            if (fileExists(filePath)) {
              const content = readFile(filePath);
              console.log(chalk.dim(`\n--- ${filePath} ---`));
              console.log(content.slice(0, 2000));
              if (content.length > 2000) {
                console.log(chalk.dim(`\n... truncated (${content.length - 2000} more chars)`));
              }
              console.log('');
            } else {
              console.log(chalk.red(`File not found: ${filePath}`));
            }
          } else if (line === '/test' || line === '/t') {
            const gen = new TestGenerator(config);
            const result = await gen.detectAndRun();
            console.log(`\n  ${chalk.green(result.passed)} pass, ${chalk.red(result.failed)} fail, ${chalk.gray(result.skipped)} skip\n`);
          } else if (line.startsWith('/search ') || line.startsWith('/s ')) {
            const query = line.slice(line.indexOf(' ') + 1).trim();
            const project = analyzer.analyzeProject();
            const results: string[] = [];
            for (const file of project.files) {
              if (file.path.toLowerCase().includes(query.toLowerCase())) {
                results.push(`[file] ${file.path}`);
              }
              for (const fn of file.functions) {
                if (fn.toLowerCase().includes(query.toLowerCase())) {
                  results.push(`[function] ${fn} → ${file.path}`);
                }
              }
              for (const cls of file.classes) {
                if (cls.toLowerCase().includes(query.toLowerCase())) {
                  results.push(`[class] ${cls} → ${file.path}`);
                }
              }
            }
            if (results.length > 0) {
              results.slice(0, 20).forEach((r) => console.log(`  ${r}`));
            } else {
              console.log(chalk.yellow(`  No results for "${query}"`));
            }
            console.log('');
          } else if (line.startsWith('/graph') || line === '/g') {
            const project = analyzer.analyzeProject();
            console.log(chalk.bold('\n  Entry points:'));
            project.entryPoints.forEach((ep) => console.log(`    ${ep}`));
            console.log(`\n  ${chalk.dim(`${project.graph.nodes.length} nodes, ${project.graph.edges.length} edges`)}`);
            console.log('');
          } else if (line.startsWith('/explain ') || line.startsWith('/e ')) {
            const query = line.slice(line.indexOf(' ') + 1).trim();
            try {
              const ai = new AIProviderService(config);
              const explanation = await ai.explainFile(query, { path: query, language: 'unknown', purpose: '', imports: [], exports: [], functions: [], classes: [], envVars: [], externalCalls: [], dependencies: [] });
              console.log(chalk.bold(`\n  ${explanation.summary}`));
              explanation.details.forEach((d: string) => console.log(`  • ${d}`));
              console.log('');
            } catch {
              console.log(chalk.yellow('  AI provider not available. Configure an AI provider.'));
              console.log('');
            }
          } else {
            console.log(chalk.yellow(`  Unknown command: ${line}`));
            console.log(chalk.dim('  Type /help for available commands.'));
            console.log('');
          }
        } catch (err) {
          console.log(chalk.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
          console.log('');
        }

        rl.prompt();
      });

      rl.on('close', () => {
        process.exit(0);
      });
    });
}

function showHelp(): void {
  console.log('');
  console.log(chalk.bold('REPL Commands:'));
  console.log(`  ${chalk.cyan('/help, /h')}          Show this help`);
  console.log(`  ${chalk.cyan('/quit, /q')}          Exit REPL`);
  console.log(`  ${chalk.cyan('/info')}             Project summary`);
  console.log(`  ${chalk.cyan('/file <path>')}      Analyze a file`);
  console.log(`  ${chalk.cyan('/cat <path>')}       Show file contents`);
  console.log(`  ${chalk.cyan('/search <query>')}   Search codebase`);
  console.log(`  ${chalk.cyan('/test, /t')}         Run tests`);
  console.log(`  ${chalk.cyan('/graph, /g')}        Show entry points`);
  console.log(`  ${chalk.cyan('/explain <code>')}   AI explanation`);
  console.log(`  ${chalk.cyan('/history')}          Show command history`);
  console.log(`  ${chalk.cyan('/clear')}            Clear screen`);
  console.log('');
}
