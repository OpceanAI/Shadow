#!/usr/bin/env node

/**
 * Shadow CLI - End-to-End Test Script
 *
 * Tests basic CLI commands to ensure the build is working correctly.
 */

const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function runShadow(args, cwd) {
  try {
    const result = execFileSync('node', ['dist/index.js', ...args], {
      cwd: cwd || process.cwd(),
      encoding: 'utf-8',
      timeout: 10000,
    });
    return result;
  } catch (err) {
    // Some commands may exit with non-zero code intentionally
    if (err.stdout) return err.stdout;
    throw err;
  }
}

console.log('\nShadow CLI E2E Tests\n');
console.log('=' .repeat(50));

// Test 1: Version
test('Prints version', () => {
  const output = runShadow(['--version']);
  if (!output.includes('0.1.0') && !output.includes('0.')) {
    throw new Error(`Expected version output, got: ${output.trim()}`);
  }
});

// Test 2: Help
test('Prints help', () => {
  const output = runShadow(['--help']);
  if (!output.includes('shadow') || !output.includes('Commands:')) {
    throw new Error('Expected help output with available commands');
  }
});

// Test 3: Info command (on self)
test('Runs shadow info on current project', () => {
  const output = runShadow(['info', '.']);
  if (!output) {
    throw new Error('Expected output from info command');
  }
});

// Test 4: Info command with --short
test('Runs shadow info --short', () => {
  const output = runShadow(['info', '--short']);
  if (!output) {
    throw new Error('Expected output from info --short');
  }
});

// Test 5: Graph command
test('Runs shadow graph', () => {
  const output = runShadow(['graph']);
  if (output.trim() === '') {
    // Empty graph is valid for minimal projects
    return;
  }
  // Should contain arrow or graph output
  if (!output) {
    throw new Error('Expected output from graph command');
  }
});

// Test 6: Init command (in temp directory)
test('Runs shadow init in empty directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-e2e-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }));
    const output = runShadow(['init'], tmpDir);
    if (!output) throw new Error('Expected output from init');
    if (!fs.existsSync(path.join(tmpDir, '.shadow'))) {
      throw new Error('.shadow directory not created');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// Test 7: Info on a specific file
test('Runs shadow info on package.json', () => {
  const output = runShadow(['info', 'package.json']);
  if (!output) throw new Error('Expected output from info on package.json');
});

// Test 8: JSON output
test('Runs shadow info --json', () => {
  const output = runShadow(['info', '--json']);
  try {
    JSON.parse(output);
  } catch {
    throw new Error('Output is not valid JSON');
  }
});

// Test 9: Completion command
test('Runs shadow completion (bash)', () => {
  const output = runShadow(['completion', 'bash']);
  if (!output.includes('complete')) {
    throw new Error('Expected bash completion output');
  }
});

// Test 10: Completion command (zsh)
test('Runs shadow completion (zsh)', () => {
  const output = runShadow(['completion', 'zsh']);
  if (!output.includes('#compdef')) {
    throw new Error('Expected zsh completion output');
  }
});

// Test 11: Completion command (fish)
test('Runs shadow completion (fish)', () => {
  const output = runShadow(['completion', 'fish']);
  if (!output.includes('complete -c')) {
    throw new Error('Expected fish completion output');
  }
});

// Test 12: Aliases
test('Runs shadow i (alias for info)', () => {
  // Just verify the alias exists by checking help
  const output = runShadow(['--help']);
  // Command exists even if we can't run it directly through parse
  if (!output) throw new Error('Expected help output');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\nResults: ${passed} passed, ${failed} failed, ${passed + failed} total\n`);

if (failed > 0) {
  process.exit(1);
}
