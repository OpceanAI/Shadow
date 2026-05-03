import { describe, it, expect } from 'vitest';
import { GraphBuilder } from '../../core/graph';
import { FileInfo, DependencyGraph } from '../../types';

const builder = new GraphBuilder();

function makeFile(overrides: Partial<FileInfo> = {}): FileInfo {
  return {
    path: 'src/index.ts',
    language: 'typescript',
    purpose: 'Entry point',
    imports: [],
    exports: [],
    functions: [],
    classes: [],
    envVars: [],
    externalCalls: [],
    dependencies: [],
    ...overrides,
  };
}

describe('GraphBuilder.buildFromFiles', () => {
  it('creates nodes for each file', () => {
    const files = [
      makeFile({ path: 'src/a.ts' }),
      makeFile({ path: 'src/b.ts' }),
    ];
    const graph = builder.buildFromFiles(files);
    const fileNodes = graph.nodes.filter((n) => n.type === 'file');
    expect(fileNodes.length).toBe(2);
  });

  it('creates edges for imports', () => {
    const files = [
      makeFile({
        path: 'src/index.ts',
        imports: [{ name: 'express', type: 'external' }, { name: 'lodash', type: 'external' }],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const importEdges = graph.edges.filter((e) => e.type === 'imports');
    expect(importEdges.length).toBe(2);
  });

  it('creates external nodes for external imports', () => {
    const files = [
      makeFile({
        path: 'src/app.ts',
        imports: [{ name: 'axios', type: 'external' }],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const externalNodes = graph.nodes.filter((n) => n.type === 'external');
    expect(externalNodes.length).toBe(1);
    expect(externalNodes[0].label).toBe('axios');
  });

  it('creates edges for env vars', () => {
    const files = [
      makeFile({
        path: 'src/app.ts',
        envVars: ['PORT', 'DATABASE_URL'],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const envEdges = graph.edges.filter((e) => e.type === 'reads_env');
    expect(envEdges.length).toBe(2);
  });

  it('creates env nodes', () => {
    const files = [
      makeFile({
        path: 'src/config.ts',
        envVars: ['DATABASE_URL'],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const envNodes = graph.nodes.filter((n) => n.type === 'env');
    expect(envNodes.length).toBe(1);
    expect(envNodes[0].label).toBe('DATABASE_URL');
  });

  it('creates network edges for external API calls', () => {
    const files = [
      makeFile({
        path: 'src/api.ts',
        externalCalls: ['api.example.com', 'cdn.example.com'],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const networkEdges = graph.edges.filter((e) => e.type === 'network');
    expect(networkEdges.length).toBe(2);
  });

  it('deduplicates nodes', () => {
    const files = [
      makeFile({
        path: 'src/a.ts',
        imports: [{ name: 'express', type: 'external' }],
      }),
      makeFile({
        path: 'src/b.ts',
        imports: [{ name: 'express', type: 'external' }],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const expressNodes = graph.nodes.filter((n) => n.label === 'express');
    expect(expressNodes.length).toBe(1);
  });

  it('handles empty file list', () => {
    const graph = builder.buildFromFiles([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('sets correct edge directions', () => {
    const files = [
      makeFile({
        path: 'src/main.ts',
        imports: [{ name: './utils', type: 'internal' }],
      }),
    ];
    const graph = builder.buildFromFiles(files);
    const edge = graph.edges[0];
    expect(edge.from).toBe('src/main.ts');
    expect(edge.to).toBe('./utils');
  });
});

describe('GraphBuilder.toDOT', () => {
  it('produces valid DOT format', () => {
    const graph: DependencyGraph = {
      nodes: [
        { id: 'src/index.ts', path: 'src/index.ts', type: 'file', label: 'index.ts' },
        { id: 'express', path: 'express', type: 'external', label: 'express' },
      ],
      edges: [
        { from: 'src/index.ts', to: 'express', type: 'imports' },
      ],
    };

    const dot = builder.toDOT(graph);
    expect(dot).toContain('digraph Shadow');
    expect(dot).toContain('rankdir=LR');
    expect(dot).toContain('"src/index.ts"');
    expect(dot).toContain('"express"');
    expect(dot).toContain('->');
  });

  it('includes color for env nodes', () => {
    const graph: DependencyGraph = {
      nodes: [
        { id: 'src/app.ts', path: 'src/app.ts', type: 'file', label: 'app.ts' },
        { id: 'env:PORT', path: '', type: 'env', label: 'PORT' },
      ],
      edges: [{ from: 'src/app.ts', to: 'env:PORT', type: 'reads_env' }],
    };

    const dot = builder.toDOT(graph);
    expect(dot).toContain('fillcolor=lightyellow');
  });

  it('includes color for external nodes', () => {
    const graph: DependencyGraph = {
      nodes: [
        { id: 'src/app.ts', path: 'src/app.ts', type: 'file', label: 'app.ts' },
        { id: 'api:example.com', path: '', type: 'external', label: 'example.com' },
      ],
      edges: [{ from: 'src/app.ts', to: 'api:example.com', type: 'network' }],
    };

    const dot = builder.toDOT(graph);
    expect(dot).toContain('fillcolor=lightcoral');
  });

  it('handles empty graph', () => {
    const dot = builder.toDOT({ nodes: [], edges: [] });
    expect(dot).toContain('digraph Shadow');
    expect(dot).toContain('}');
  });
});

describe('GraphBuilder.toText', () => {
  it('produces text representation', () => {
    const graph: DependencyGraph = {
      nodes: [
        { id: 'src/main.ts', path: 'src/main.ts', type: 'file', label: 'main.ts' },
        { id: './utils', path: './utils', type: 'file', label: 'utils' },
      ],
      edges: [
        { from: 'src/main.ts', to: './utils', type: 'imports' },
      ],
    };

    const text = builder.toText(graph);
    expect(text).toContain('main.ts');
    expect(text).toContain('utils');
    expect(text).toContain('→');
    expect(text).toContain('imports');
  });

  it('returns empty string for empty graph', () => {
    const text = builder.toText({ nodes: [], edges: [] });
    expect(text).toBe('');
  });

  it('renders all edge types', () => {
    const graph: DependencyGraph = {
      nodes: [
        { id: 'a', path: 'a', type: 'file', label: 'a' },
        { id: 'b', path: 'b', type: 'file', label: 'b' },
        { id: 'c', path: 'c', type: 'file', label: 'c' },
        { id: 'd', path: 'd', type: 'file', label: 'd' },
        { id: 'e', path: 'e', type: 'file', label: 'e' },
      ],
      edges: [
        { from: 'a', to: 'b', type: 'imports' },
        { from: 'b', to: 'c', type: 'calls' },
        { from: 'c', to: 'd', type: 'references' },
      ],
    };

    const text = builder.toText(graph);
    expect(text.split('\n').length).toBe(3);
  });
});
