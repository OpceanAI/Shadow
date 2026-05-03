import { describe, it, expect } from 'vitest';
import { toJSON, projectInfoToJSON, fileInfoToJSON, graphToJSON } from '../../output/json';
import { ProjectInfo, FileInfo, DependencyGraph } from '../../types';

describe('toJSON', () => {
  it('stringifies an object', () => {
    const obj = { name: 'shadow', version: '0.1.0' };
    const result = toJSON(obj);
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(obj);
  });

  it('includes indentation', () => {
    const obj = { a: 1 };
    const result = toJSON(obj);
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('handles arrays', () => {
    const arr = [1, 2, 3];
    const result = toJSON(arr);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('handles primitive values', () => {
    expect(toJSON(42)).toBe('42');
    expect(toJSON('hello')).toBe('"hello"');
    expect(toJSON(true)).toBe('true');
  });
});

describe('projectInfoToJSON', () => {
  const projectInfo: ProjectInfo = {
    name: 'test-project',
    rootPath: '/home/user/project',
    language: 'typescript',
    summary: 'A test project',
    files: [],
    entryPoints: ['src/index.ts'],
    envVars: ['PORT'],
    externalAPIs: ['api.example.com'],
    totalFiles: 0,
    graph: { nodes: [], edges: [] },
  };

  it('includes shadow marker', () => {
    const result = projectInfoToJSON(projectInfo);
    expect(result).toHaveProperty('shadow', true);
  });

  it('includes type field', () => {
    const result = projectInfoToJSON(projectInfo);
    expect(result).toHaveProperty('type', 'project_info');
  });

  it('preserves all project info fields', () => {
    const result = projectInfoToJSON(projectInfo) as any;
    expect(result.name).toBe('test-project');
    expect(result.language).toBe('typescript');
    expect(result.summary).toBe('A test project');
    expect(result.rootPath).toBe('/home/user/project');
  });

  it('preserves arrays', () => {
    const result = projectInfoToJSON(projectInfo) as any;
    expect(result.entryPoints).toEqual(['src/index.ts']);
    expect(result.envVars).toEqual(['PORT']);
    expect(result.externalAPIs).toEqual(['api.example.com']);
  });
});

describe('fileInfoToJSON', () => {
  const fileInfo: FileInfo = {
    path: 'src/index.ts',
    language: 'typescript',
    purpose: 'Entry point',
    imports: [{ name: 'express', type: 'external' }],
    exports: ['createApp'],
    functions: ['main'],
    classes: ['App'],
    envVars: ['PORT'],
    externalCalls: ['api.example.com'],
    dependencies: [],
  };

  it('includes shadow marker', () => {
    const result = fileInfoToJSON(fileInfo);
    expect(result).toHaveProperty('shadow', true);
  });

  it('includes type field', () => {
    const result = fileInfoToJSON(fileInfo);
    expect(result).toHaveProperty('type', 'file_info');
  });

  it('preserves file fields', () => {
    const result = fileInfoToJSON(fileInfo) as any;
    expect(result.path).toBe('src/index.ts');
    expect(result.language).toBe('typescript');
    expect(result.purpose).toBe('Entry point');
    expect(result.functions).toEqual(['main']);
    expect(result.classes).toEqual(['App']);
  });
});

describe('graphToJSON', () => {
  const graph: DependencyGraph = {
    nodes: [
      { id: 'src/main.ts', path: 'src/main.ts', type: 'file', label: 'main.ts' },
      { id: 'express', path: 'express', type: 'external', label: 'express' },
    ],
    edges: [
      { from: 'src/main.ts', to: 'express', type: 'imports' },
    ],
  };

  it('includes shadow marker', () => {
    const result = graphToJSON(graph);
    expect(result).toHaveProperty('shadow', true);
  });

  it('includes type field', () => {
    const result = graphToJSON(graph);
    expect(result).toHaveProperty('type', 'dependency_graph');
  });

  it('preserves nodes and edges', () => {
    const result = graphToJSON(graph) as any;
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.nodes[0].label).toBe('main.ts');
  });
});
