import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { Analyzer } from '../../core/analyzer';
import { GraphBuilder } from '../../core/graph';
import { ShadowConfig } from '../../types';

const defaultConfig: ShadowConfig = {
  aiProvider: 'local',
  outputStyle: 'human',
  cacheEnabled: false,
  privacy: {
    maskSecrets: true,
    noNetwork: false,
    allowCloudAI: false,
  },
  testGeneration: {
    fuzzCount: 10,
    includeSecurity: false,
    excludePaths: [],
  },
  deploymentChecks: {
    requiredEnvVars: [],
    buildCommand: '',
    smokeTestCommand: '',
  },
  ignoredPaths: ['.git', 'node_modules'],
  entryPoints: [],
};

describe('Performance benchmarks', () => {
  // Generate a directory with many files to benchmark
  // These tests verify the analyzer scales linearly

  it('analyzes project with many files within reasonable time', () => {
    const analyzer = new Analyzer(defaultConfig, __dirname);

    const start = performance.now();
    const project = analyzer.analyzeProject();
    const elapsed = performance.now() - start;

    // Should complete in under 5 seconds for this codebase
    expect(elapsed).toBeLessThan(5000);
    expect(project.files.length).toBeGreaterThan(0);
  });

  it('analyzes a single file quickly', () => {
    const fixturesDir = path.join(__dirname, '..', 'fixtures');
    const analyzer = new Analyzer(defaultConfig, fixturesDir);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      analyzer.analyzeFile(path.join(fixturesDir, 'python-sample.py'));
    }
    const elapsed = performance.now() - start;
    const perFile = elapsed / 100;

    // Each file analysis should be under 100ms
    expect(perFile).toBeLessThan(100);
  });

  it('graph building scales with node count', () => {
    const builder = new GraphBuilder();

    const files = Array.from({ length: 200 }, (_, i) => ({
      path: `src/module${i}.ts`,
      language: 'typescript' as const,
      purpose: 'Source file',
      imports: [
        { name: `dep${(i * 3) % 57}`, type: 'external' as const },
        { name: `dep${(i * 7) % 89}`, type: 'external' as const },
      ],
      exports: [],
      functions: [`fn${i}`],
      classes: [`Class${i}`],
      envVars: [`VAR_${i % 10}`],
      externalCalls: [`api${i % 5}.example.com`],
      dependencies: [],
    }));

    const start = performance.now();
    const graph = builder.buildFromFiles(files);
    const elapsed = performance.now() - start;

    expect(graph.nodes.length).toBeGreaterThan(200);
    expect(graph.edges.length).toBeGreaterThan(400);
    expect(elapsed).toBeLessThan(500);
  });

  it('DOT generation is fast for large graphs', () => {
    const builder = new GraphBuilder();

    const nodes = Array.from({ length: 500 }, (_, i) => ({
      id: `node${i}`,
      path: `src/module${i}.ts`,
      type: 'file' as const,
      label: `module${i}.ts`,
    }));

    const edges = Array.from({ length: 1000 }, (_, i) => ({
      from: `node${i % 500}`,
      to: `node${(i * 7 + 3) % 500}`,
      type: 'imports' as const,
    }));

    const start = performance.now();
    const dot = builder.toDOT({ nodes, edges });
    const elapsed = performance.now() - start;

    expect(dot).toContain('digraph Shadow');
    expect(elapsed).toBeLessThan(500);
  });
});
