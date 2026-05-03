#!/usr/bin/env node

/**
 * Shadow CLI - Post-install Script
 *
 * Runs after npm install to show a getting started message.
 */

let chalk;
try {
  chalk = require('chalk');
} catch {
  chalk = {
    green: (s) => s,
    cyan: (s) => s,
    dim: (s) => s,
    bold: (s) => s,
    yellow: (s) => s,
  };
}

function printBanner() {
  console.log('');
  console.log(chalk.cyan('  ╔═══════════════════════════════════════╗'));
  console.log(chalk.cyan('  ║        ') + chalk.bold('Shadow CLI Installed!') + chalk.cyan('        ║'));
  console.log(chalk.cyan('  ╚═══════════════════════════════════════╝'));
  console.log('');
}

function printQuickStart() {
  console.log(chalk.bold('Quick Start:'));
  console.log('');
  console.log(`  ${chalk.cyan('shadow . --info')}        ${chalk.dim('# Analyze current project')}`);
  console.log(`  ${chalk.cyan('shadow info <file>')}    ${chalk.dim('# Analyze a single file')}`);
  console.log(`  ${chalk.cyan('shadow graph')}           ${chalk.dim('# Show dependency graph')}`);
  console.log(`  ${chalk.cyan('shadow test')}            ${chalk.dim('# Generate & run tests')}`);
  console.log(`  ${chalk.cyan('shadow tutorial')}        ${chalk.dim('# Interactive tutorial')}`);
  console.log('');
}

function printAIInfo() {
  var key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.log(chalk.yellow('To enable AI features, set an API key:'));
    console.log(`  ${chalk.dim('export OPENAI_API_KEY="sk-..."')}`);
    console.log('');
  }
}

function printDocs() {
  console.log(chalk.bold('Documentation:'));
  console.log(`  ${chalk.dim('https://github.com/OpceanAI/Shadow')}`);
  console.log(`  ${chalk.dim('Run "shadow --help" for command reference')}`);
  console.log('');
}

function printCompletion() {
  var shell = process.env.SHELL || '';
  if (shell.includes('bash')) {
    console.log(chalk.bold('Shell completion:'));
    console.log(`  ${chalk.dim('source <(shadow completion bash) >> ~/.bashrc')}`);
    console.log('');
  } else if (shell.includes('zsh')) {
    console.log(chalk.bold('Shell completion:'));
    console.log(`  ${chalk.dim('source <(shadow completion zsh) >> ~/.zshrc')}`);
    console.log('');
  }
}

// Main
try {
  printBanner();
  printQuickStart();
  printAIInfo();
  printCompletion();
  printDocs();
} catch (err) {
  console.log('\nShadow CLI installed! Run "shadow --help" to get started.\n');
}
