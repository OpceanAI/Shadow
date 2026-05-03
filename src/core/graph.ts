import { DependencyGraph, GraphNode, GraphEdge, ImportInfo, FileInfo } from '../types';

export class GraphBuilder {
  buildFromFiles(files: FileInfo[]): DependencyGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodes = new Set<string>();

    for (const file of files) {
      const nodeId = file.path;
      if (!seenNodes.has(nodeId)) {
        nodes.push({
          id: nodeId,
          path: file.path,
          type: 'file',
          label: file.path.split('/').pop() || file.path,
        });
        seenNodes.add(nodeId);
      }

      for (const imp of file.imports) {
        edges.push({
          from: nodeId,
          to: imp.name,
          type: 'imports',
        });

        if (!seenNodes.has(imp.name)) {
          nodes.push({
            id: imp.name,
            path: imp.name,
            type: imp.type === 'external' ? 'external' : 'file',
            label: imp.name,
          });
          seenNodes.add(imp.name);
        }
      }

      for (const envVar of file.envVars) {
        const envId = `env:${envVar}`;
        if (!seenNodes.has(envId)) {
          nodes.push({ id: envId, path: '', type: 'env', label: envVar });
          seenNodes.add(envId);
        }
        edges.push({ from: nodeId, to: envId, type: 'reads_env' });
      }

      for (const api of file.externalCalls) {
        const apiId = `api:${api}`;
        if (!seenNodes.has(apiId)) {
          nodes.push({ id: apiId, path: '', type: 'external', label: api });
          seenNodes.add(apiId);
        }
        edges.push({ from: nodeId, to: apiId, type: 'network' });
      }
    }

    return { nodes, edges };
  }

  toDOT(graph: DependencyGraph): string {
    let dot = 'digraph Shadow {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box, style=rounded];\n';

    for (const node of graph.nodes) {
      const color =
        node.type === 'env'
          ? ', fillcolor=lightyellow, style=filled'
          : node.type === 'external'
            ? ', fillcolor=lightcoral, style=filled'
            : '';
      dot += `  "${node.id}" [label="${node.label}"${color}];\n`;
    }

    for (const edge of graph.edges) {
      dot += `  "${edge.from}" -> "${edge.to}";\n`;
    }

    dot += '}\n';
    return dot;
  }

  toText(graph: DependencyGraph): string {
    const lines: string[] = [];
    for (const edge of graph.edges) {
      const fromLabel = graph.nodes.find((n) => n.id === edge.from)?.label || edge.from;
      const toLabel = graph.nodes.find((n) => n.id === edge.to)?.label || edge.to;
      lines.push(`  ${fromLabel} → ${toLabel} (${edge.type})`);
    }
    return lines.join('\n');
  }
}
