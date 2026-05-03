import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import { Analyzer } from '../../core/analyzer';
import { ProjectInfo, FileInfo, ShadowConfig } from '../../types';

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

const fixturesDir = path.join(__dirname, '..', 'fixtures');

describe('info command logic', () => {
  it('analyzes file when target is a file', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);
    const filePath = path.join(fixturesDir, 'python-sample.py');

    const info = analyzer.analyzeFile(filePath);

    expect(info.path).toBeTruthy();
    expect(info.language).toBe('python');
    expect(info.functions.length).toBeGreaterThan(0);
    expect(info.classes.length).toBeGreaterThan(0);
    expect(Array.isArray(info.imports)).toBe(true);
    expect(Array.isArray(info.envVars)).toBe(true);
  });

  it('analyzes project when target is a directory', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);

    const project = analyzer.analyzeProject();

    expect(project.name).toBeTruthy();
    expect(project.rootPath).toBeTruthy();
    expect(project.language).toBeTruthy();
    expect(project.summary).toBeTruthy();
    expect(project.files.length).toBeGreaterThan(0);
    expect(project.totalFiles).toBe(project.files.length);
  });

  it('short format returns concise output', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);
    const project = analyzer.analyzeProject();

    // Short format is just the summary line
    expect(project.summary).toContain(project.language);
    expect(project.summary).toContain('files');
  });

  it('full format includes imports and env vars', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);
    const project = analyzer.analyzeProject();

    expect(project.entryPoints).toBeDefined();
    expect(project.envVars).toBeDefined();
    expect(project.externalAPIs).toBeDefined();
  });

  it('JSON output is valid', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);
    const project = analyzer.analyzeProject();

    const json = JSON.stringify(project);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe(project.name);
    expect(parsed.language).toBe(project.language);
    expect(parsed.totalFiles).toBe(project.totalFiles);
  });

  it('handles non-existent file gracefully', () => {
    const config = { ...defaultConfig };
    const analyzer = new Analyzer(config, fixturesDir);

    expect(() => {
      analyzer.analyzeFile('/nonexistent/file.txt');
    }).toThrow();
  });
});
