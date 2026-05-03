#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

import { initCommand } from './commands/init';
import { infoCommand } from './commands/info';
import { graphCommand } from './commands/graph';
import { traceCommand } from './commands/trace';
import { testCommand } from './commands/test';
import { aiCommand } from './commands/ai';
import { fixCommand } from './commands/fix';
import { commitCommand } from './commands/commit';
import { diffCommand } from './commands/diff';
import { deployCommand } from './commands/deploy';
import { watchCommand } from './commands/watch';
import { explainCommand } from './commands/explain';
import { inspectCommand } from './commands/inspect';
import { exportCommand } from './commands/export';
import { historyCommand } from './commands/history';
import { searchCommand } from './commands/search';
import { reviewCommand } from './commands/review';
import { docCommand } from './commands/doc';
import { metricsCommand } from './commands/metrics';
import { securityCommand } from './commands/security';
import { perfCommand } from './commands/perf';
import { depsCommand } from './commands/deps';
import { lintCommand } from './commands/lint';
import { formatCommand } from './commands/format';
import { blameCommand } from './commands/blame';
import { compareCommand } from './commands/compare';
import { timelineCommand } from './commands/timeline';
import { contributorsCommand } from './commands/contributors';
import { prCommand } from './commands/pr';
import { issueCommand } from './commands/issue';
import { scaffoldCommand } from './commands/scaffold';
import { migrateCommand } from './commands/migrate';
import { packCommand } from './commands/pack';
import { mcpCommand } from './commands/mcp';
import { serverCommand } from './commands/server';
import { replCommand } from './commands/repl';
import { advancedCommand } from './commands/advanced';
import { tutorialCommand } from './commands/tutorial';
import { completionCommand } from './commands/completion';
import { pluginCommand } from './commands/plugin';

const program = new Command();

program
  .name('shadow')
  .description('Understand, trace, test, and improve any codebase from the terminal.')
  .version('0.1.0')
  .addHelpText(
    'after',
    `
${chalk.dim('Examples:')}
  ${chalk.cyan('shadow . --info')}          Inspect current project
  ${chalk.cyan('shadow trace python app.py')}  Trace a running app
  ${chalk.cyan('shadow test --ai openai')}   Generate AI-powered tests
  ${chalk.cyan('shadow diff --from main --to feature/auth')}  Compare versions
  ${chalk.cyan('shadow commit')}            Get a commit suggestion

${chalk.dim('Documentation: https://github.com/OpceanAI/Shadow')}
`,
  );

// ── Original commands ──────────────────────────────────────────────────────
initCommand(program);
infoCommand(program);
graphCommand(program);
traceCommand(program);
testCommand(program);
aiCommand(program);
fixCommand(program);
commitCommand(program);
diffCommand(program);
deployCommand(program);
watchCommand(program);
explainCommand(program);
inspectCommand(program);
exportCommand(program);
historyCommand(program);

// ── New Phase 5 commands ───────────────────────────────────────────────────
searchCommand(program);
reviewCommand(program);
docCommand(program);
metricsCommand(program);
securityCommand(program);
perfCommand(program);
depsCommand(program);
lintCommand(program);
formatCommand(program);
blameCommand(program);
compareCommand(program);
timelineCommand(program);
contributorsCommand(program);
prCommand(program);
issueCommand(program);
scaffoldCommand(program);
migrateCommand(program);
packCommand(program);
mcpCommand(program);
serverCommand(program);
replCommand(program);
  advancedCommand(program);
  tutorialCommand(program);
  completionCommand(program);
  pluginCommand(program);

// ── Short aliases ──────────────────────────────────────────────────────────
program.command('i [target]').description('Alias for shadow info').action((target, opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'info', ...(target ? [target] : [])], { from: 'user' });
  }
});

program.command('g').description('Alias for shadow graph').action((opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'graph'], { from: 'user' });
  }
});

program.command('t').description('Alias for shadow test').action((opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'test'], { from: 'user' });
  }
});

program.command('f').description('Alias for shadow fix').action((opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'fix'], { from: 'user' });
  }
});

program.command('c').description('Alias for shadow commit').action((opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'commit'], { from: 'user' });
  }
});

program.command('d').description('Alias for shadow diff').action((opts, cmd) => {
  const parent = cmd.parent as Command | undefined;
  if (parent) {
    parent.parseAsync(['node', 'shadow', 'diff'], { from: 'user' });
  }
});

program.parse(process.argv);
