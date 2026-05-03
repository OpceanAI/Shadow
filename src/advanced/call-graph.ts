import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface CallNode {
  id: string;
  name: string;
  file: string;
  line: number;
  type: 'definition' | 'call' | 'external';
  qualifiedName?: string;
}

export interface CallEdge {
  from: string;
  to: string;
  count: number;
  files: string[];
}

export interface CallGraph {
  nodes: CallNode[];
  edges: CallEdge[];
  stats: {
    totalCalls: number;
    totalDefinitions: number;
    maxDepth: number;
    recursiveCalls: string[];
    mostCalled: Array<{ name: string; count: number }>;
    deepestChain: string[];
  };
}

export interface CallChain {
  path: string[];
  depth: number;
}

export class CallGraphBuilder {
  build(projectPath?: string): CallGraph {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const nodes: CallNode[] = [];
    const edges: CallEdge[] = [];
    const nodeMap = new Map<string, CallNode>();
    let nodeIndex = 0;

    for (const file of files) {
      try {
        const content = readFile(file);
        const defs = this.extractDefinitions(content, file);
        const calls = this.extractCalls(content, file);

        for (const def of defs) {
          const id = `n${nodeIndex++}`;
          const node: CallNode = {
            id,
            name: def.name,
            file,
            line: def.line,
            type: 'definition',
          };
          nodes.push(node);
          nodeMap.set(`${file}:${def.name}`, node);
        }

        for (const call of calls) {
          const id = `n${nodeIndex++}`;
          const node: CallNode = {
            id,
            name: call.name,
            file,
            line: call.line,
            type: 'call',
          };
          nodes.push(node);
          nodeMap.set(`${id}`, node);

          // Link calls to definitions if found
          for (const existingNode of nodes) {
            if (
              existingNode.name === call.name &&
              existingNode.type === 'definition'
            ) {
              const existing = edges.find(
                (e) => e.from === `${file}#${call.name}` && e.to === existingNode.id,
              );
              if (existing) {
                existing.count++;
                if (!existing.files.includes(file)) {
                  existing.files.push(file);
                }
              } else {
                edges.push({
                  from: `${file}#${call.name}`,
                  to: existingNode.id,
                  count: 1,
                  files: [file],
                });
              }
            }
          }
        }
      } catch {
        // skip
      }
    }

    const stats = this.computeStats(nodes, edges);

    return { nodes, edges, stats };
  }

  private extractDefinitions(content: string, file: string): Array<{ name: string; line: number }> {
    const defs: Array<{ name: string; line: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const fnMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
      if (fnMatch) {
        defs.push({ name: fnMatch[1] || fnMatch[2], line: i + 1 });
      }

      const arrowMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        defs.push({ name: arrowMatch[1], line: i + 1 });
      }

      const pyMatch = line.match(/^def\s+(\w+)/);
      if (pyMatch) {
        defs.push({ name: pyMatch[1], line: i + 1 });
      }

      const goMatch = line.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/);
      if (goMatch) {
        defs.push({ name: goMatch[1], line: i + 1 });
      }

      const rustMatch = line.match(/fn\s+(\w+)\s*\(/);
      if (rustMatch) {
        defs.push({ name: rustMatch[1], line: i + 1 });
      }
    }

    return defs;
  }

  private extractCalls(content: string, file: string): Array<{ name: string; line: number }> {
    const calls: Array<{ name: string; line: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const callRegex = /(\w+)\s*\(/g;
      let match: RegExpExecArray | null;
      const keywords = new Set([
        'if', 'for', 'while', 'switch', 'catch', 'return', 'throw',
        'typeof', 'instanceof', 'new', 'import', 'export', 'class',
        'function', 'const', 'let', 'var', 'async', 'await',
      ]);

      while ((match = callRegex.exec(line)) !== null) {
        const name = match[1];
        if (!keywords.has(name) && name.length > 1) {
          calls.push({ name, line: i + 1 });
        }
      }
    }

    return calls;
  }

  private computeStats(
    nodes: CallNode[],
    edges: CallEdge[],
  ): CallGraph['stats'] {
    const totalCalls = nodes.filter((n) => n.type === 'call').length;
    const totalDefinitions = nodes.filter((n) => n.type === 'definition').length;

    const callCounts = new Map<string, number>();
    for (const edge of edges) {
      const target = nodes.find((n) => n.id === edge.to);
      if (target) {
        callCounts.set(target.name, (callCounts.get(target.name) || 0) + edge.count);
      }
    }

    const mostCalled = Array.from(callCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recursiveCalls = this.detectRecursiveCalls(nodes, edges);

    const deepest = this.findDeepestChain(nodes, edges);

    let maxDepth = 0;
    try {
      maxDepth = deepest.depth;
    } catch {
      maxDepth = 0;
    }

    return {
      totalCalls,
      totalDefinitions,
      maxDepth,
      recursiveCalls,
      mostCalled,
      deepestChain: deepest.path,
    };
  }

  detectRecursiveCalls(nodes: CallNode[], edges: CallEdge[]): string[] {
    const recursives = new Set<string>();

    for (const node of nodes) {
      if (node.type !== 'definition') continue;
      const calls = edges.filter((e) => e.from.startsWith(`${node.file}#`));
      for (const call of calls) {
        if (call.to === node.id) {
          recursives.add(node.name);
        }
      }
    }

    return Array.from(recursives);
  }

  findDeepestChain(nodes: CallNode[], edges: CallEdge[]): CallChain {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const neighbors = adjacency.get(edge.from) || [];
      neighbors.push(edge.to);
      adjacency.set(edge.from, neighbors);
    }

    let deepestPath: string[] = [];
    let maxDepth = 0;

    const defNodes = nodes.filter((n) => n.type === 'definition');
    for (const node of defNodes) {
      const visited = new Set<string>();
      const path: string[] = [];

      const dfs = (currentId: string, depth: number) => {
        if (depth > maxDepth) {
          maxDepth = depth;
          deepestPath = [...path, currentId];
        }
        visited.add(currentId);

        const neighbors = adjacency.get(currentId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            path.push(currentId);
            dfs(neighbor, depth + 1);
            path.pop();
          }
        }
      };

      dfs(node.id, 0);
    }

    return {
      path: deepestPath.map((id) => nodes.find((n) => n.id === id)?.name || id),
      depth: maxDepth,
    };
  }

  analyzeCallFrequencies(): Record<string, number> {
    const graph = this.build();
    const frequencies: Record<string, number> = {};

    for (const edge of graph.edges) {
      const target = graph.nodes.find((n) => n.id === edge.to);
      if (target) {
        frequencies[target.name] = (frequencies[target.name] || 0) + edge.count;
      }
    }

    return frequencies;
  }
}

export function printCallGraph(): void {
  const builder = new CallGraphBuilder();
  const graph = builder.build();

  console.log(chalk.bold.blue('\n[shadow callgraph]\n'));

  console.log(chalk.bold('Call Graph Stats:'));
  console.log(`  Function definitions: ${graph.stats.totalDefinitions}`);
  console.log(`  Function calls:       ${graph.stats.totalCalls}`);
  console.log(`  Max call depth:       ${graph.stats.maxDepth}`);
  console.log();

  if (graph.stats.mostCalled.length > 0) {
    console.log(chalk.bold('Most Called Functions:'));
    for (const fn of graph.stats.mostCalled.slice(0, 10)) {
      console.log(`  ${chalk.cyan(fn.name)} ${chalk.dim(`(called ${fn.count}x)`)}`);
    }
    console.log();
  }

  if (graph.stats.recursiveCalls.length > 0) {
    console.log(chalk.bold.yellow('Recursive Functions Detected:'));
    for (const fn of graph.stats.recursiveCalls) {
      console.log(`  ${chalk.yellow('↻')} ${fn}`);
    }
    console.log();
  }

  if (graph.stats.deepestChain.length > 0) {
    console.log(chalk.bold('Deepest Call Chain:'));
    console.log('  ' + graph.stats.deepestChain.map((n) => chalk.cyan(n)).join(chalk.dim(' → ')));
    console.log();
  }
}
