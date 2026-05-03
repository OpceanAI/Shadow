import { DependencyGraph, GraphNode, GraphEdge } from '../types';

export function graphToMermaid(graph: DependencyGraph): string {
  const lines: string[] = ['graph LR'];

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodeIdToLabel: Record<string, string> = {};

  for (const node of graph.nodes) {
    const safeId = sanitizeId(node.id);
    nodeIdToLabel[node.id] = safeId;
    const shape = getNodeShape(node.type);
    lines.push(`  ${safeId}${shape}"${escapeLabel(node.label)}"`);
  }

  const edgeMap = new Map<string, { from: string; to: string; type: string }>();
  for (const edge of graph.edges) {
    const key = `${edge.from}->${edge.to}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge);
    }
  }

  for (const edge of edgeMap.values()) {
    const fromId = nodeIdToLabel[edge.from] || sanitizeId(edge.from);
    const toId = nodeIdToLabel[edge.to] || sanitizeId(edge.to);
    const style = getEdgeStyle(edge.type);
    const label = edge.type !== 'imports' ? `|${edge.type}|` : '';
    lines.push(`  ${fromId}${style}${label}${toId}`);
  }

  return lines.join('\n');
}

export function graphToMermaidFlowchart(graph: DependencyGraph): string {
  const lines: string[] = ['```mermaid', 'graph TB'];

  const grouper: Record<string, GraphNode[]> = {};
  for (const node of graph.nodes) {
    const group = node.type;
    if (!grouper[group]) grouper[group] = [];
    grouper[group].push(node);
  }

  const groupColors: Record<string, string> = {
    file: '#3b82f6',
    function: '#8b5cf6',
    class: '#ec4899',
    env: '#eab308',
    external: '#ef4444',
  };

  for (const [group, nodes] of Object.entries(grouper)) {
    const color = groupColors[group] || '#6b7280';
    lines.push(`  subgraph ${group}[${group}]`);
    lines.push(`  style ${group} fill:${color}22,stroke:${color}`);
    for (const node of nodes) {
      const safeId = sanitizeId(node.id);
      lines.push(`    ${safeId}["${escapeLabel(node.label)}"]`);
    }
    lines.push('  end');
  }

  for (const edge of graph.edges) {
    const fromId = sanitizeId(edge.from);
    const toId = sanitizeId(edge.to);
    lines.push(`  ${fromId} -->|${edge.type}| ${toId}`);
  }

  lines.push('```');
  return lines.join('\n');
}

export function projectToMermaid({ files }: { files: { path: string; imports: { name: string; type: string }[] }[] }): string {
  const lines: string[] = ['graph LR'];
  const nodeIds = new Set<string>();

  for (const file of files) {
    const fileId = sanitizeId(file.path);
    const fileName = file.path.split('/').pop() || file.path;
    lines.push(`  ${fileId}["${escapeLabel(fileName)}"]`);
    nodeIds.add(fileId);

    for (const imp of file.imports) {
      const impId = sanitizeId(imp.name);
      if (imp.type === 'internal') {
        lines.push(`  ${impId}["${escapeLabel(imp.name.split('/').pop() || imp.name)}"]`);
        nodeIds.add(impId);
        lines.push(`  ${fileId} --> ${impId}`);
      } else {
        lines.push(`  ${impId}[("${escapeLabel(imp.name)}")]`);
        nodeIds.add(impId);
        lines.push(`  ${fileId} -.-> ${impId}`);
      }
    }
  }

  return lines.join('\n');
}

function sanitizeId(id: string): string {
  let safe = id.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^\d/.test(safe)) safe = 'n' + safe;
  return safe || 'node';
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"').replace(/\[/g, '(').replace(/\]/g, ')');
}

function getNodeShape(type: string): string {
  switch (type) {
    case 'env': return '[("';
    case 'external': return '(("';
    case 'function': return '{{"';
    case 'class': return '["';
    default: return '["';
  }
}

function getEdgeStyle(type: string): string {
  switch (type) {
    case 'imports': case 'calls': return ' --> ';
    case 'references': return ' -.-> ';
    case 'reads_env': return ' -- ';
    case 'network': return ' ==> ';
    default: return ' --> ';
  }
}
