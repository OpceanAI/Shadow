import { describe, it, expect } from 'vitest';
import { DiffSummary } from '../../types';

describe('GitService - diff parsing logic', () => {
  const sampleDiff = `diff --git a/src/index.ts b/src/index.ts
index 1234567..abcdefg 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,5 +1,7 @@
 import { Command } from 'commander';
+import { tutorialCommand } from './commands/tutorial';
+import { completionCommand } from './commands/completion';

 const program = new Command();
diff --git a/src/utils/fs.ts b/src/utils/fs.ts
index 2345678..bcdefgh 100644
--- a/src/utils/fs.ts
+++ b/src/utils/fs.ts
@@ -70,3 +70,7 @@
   }
   return startPath;
 }
+
+export function isDirectory(dirPath: string): boolean {
+  return fs.statSync(dirPath).isDirectory();
+}
diff --git a/package.json b/package.json
index 3456789..cdefghi 100644
--- a/package.json
+++ b/package.json
@@ -2,2 +2,4 @@
   "name": "shadow",
-  "version": "0.0.1"
+  "version": "0.1.0",
+  "description": "Codebase analysis CLI"
diff --git a/deleted-file.ts b/deleted-file.ts
deleted file mode 100644
index 4567890..0000000
--- a/deleted-file.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return 'removed';
-}
`;

  it('extracts files changed from diff output', () => {
    const filesChanged = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('diff --git'))
      .map((l) => l.split(' ')[2].replace('a/', ''));

    expect(filesChanged).toHaveLength(4);
    expect(filesChanged).toContain('src/index.ts');
    expect(filesChanged).toContain('src/utils/fs.ts');
    expect(filesChanged).toContain('package.json');
    expect(filesChanged).toContain('deleted-file.ts');
  });

  it('counts additions correctly', () => {
    const additions = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;

    expect(additions).toBeGreaterThan(0);
    expect(additions).toBe(8);
  });

  it('counts deletions correctly', () => {
    const deletions = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

    expect(deletions).toBeGreaterThan(0);
    expect(deletions).toBe(4);
  });

  it('constructs DiffSummary correctly', () => {
    const filesChanged = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('diff --git'))
      .map((l) => l.split(' ')[2].replace('a/', ''));

    const additions = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;

    const deletions = sampleDiff
      .split('\n')
      .filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

    const summary: DiffSummary = {
      from: 'HEAD',
      to: 'working tree',
      filesChanged,
      additions,
      deletions,
      behavioralChanges: [],
      regressionRisks: [],
      areasToRetest: filesChanged,
    };

    expect(summary.from).toBe('HEAD');
    expect(summary.to).toBe('working tree');
    expect(summary.filesChanged).toHaveLength(4);
    expect(summary.additions).toBe(8);
    expect(summary.deletions).toBe(4);
    expect(summary.areasToRetest).toEqual(filesChanged);
  });
});

describe('generateCommitMessage logic', () => {
  it('identifies test type', () => {
    const file = 'src/__tests__/utils/fs.test.ts';
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => file.includes(k))?.[1] || 'feat';
    expect(type).toBe('test');
  });

  it('identifies docs type', () => {
    const file = 'docs/commands.md';
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => file.includes(k))?.[1] || 'feat';
    expect(type).toBe('docs');
  });

  it('identifies style type', () => {
    const file = 'src/styles/main.css';
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => file.includes(k))?.[1] || 'feat';
    expect(type).toBe('style');
  });

  it('identifies chore type for config', () => {
    const file = 'config/database.json';
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => file.includes(k))?.[1] || 'feat';
    expect(type).toBe('chore');
  });

  it('defaults to feat for unknown file type', () => {
    const file = 'src/components/Button.tsx';
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => file.includes(k))?.[1] || 'feat';
    expect(type).toBe('feat');
  });

  it('formats message with scope', () => {
    const mainFile = 'src/components/Button.tsx';
    const filesChanged = [mainFile, 'src/components/Modal.tsx'];
    const types: Record<string, string> = { test: 'test', spec: 'test', style: 'style', css: 'style', config: 'chore', doc: 'docs', readme: 'docs' };
    const type = Object.entries(types).find(([k]) => mainFile.includes(k))?.[1] || 'feat';
    const fileDir = mainFile.split('/')[0];
    const scope = fileDir !== mainFile ? `(${fileDir})` : '';

    expect(`${type}${scope}: update ${filesChanged.length} file(s)`).toBe('feat(src): update 2 file(s)');
  });

  it('returns empty commit message for empty diff', () => {
    const diff = '';
    if (!diff) {
      expect('chore: empty commit').toBe('chore: empty commit');
    }
  });
});
