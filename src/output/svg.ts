import { DependencyGraph, GraphNode, GraphEdge } from '../types';

export interface SVGOptions {
  width?: number;
  height?: number;
  nodeWidth?: number;
  nodeHeight?: number;
  fontSize?: number;
  colors?: {
    file?: string;
    function_?: string;
    class_?: string;
    env?: string;
    external?: string;
    edge?: string;
    background?: string;
    text?: string;
  };
}

const defaultColors = {
  file: '#3b82f6',
  function_: '#8b5cf6',
  class_: '#ec4899',
  env: '#eab308',
  external: '#ef4444',
  edge: '#6b7280',
  background: '#1e1e2e',
  text: '#cdd6f4',
};

export function dotToSVG(dot: string, options: SVGOptions = {}): string {
  const graph = parseDOT(dot);
  if (!graph) return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

  const colors = { ...defaultColors, ...options.colors };
  const nodeWidth = options.nodeWidth || 160;
  const nodeHeight = options.nodeHeight || 50;
  const fontSize = options.fontSize || 12;
  const padX = 40;
  const padY = 60;

  const nodes = graph.nodes;
  const edges = graph.edges;

  const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / cols);
  const width = options.width || Math.max(800, cols * (nodeWidth + padX) + padX);
  const height = options.height || Math.max(600, rows * (nodeHeight + padY) + padY);

  const nodePositions: Map<string, { x: number; y: number }> = new Map();
  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodePositions.set(node.id, {
      x: padX + col * (nodeWidth + padX),
      y: padY + row * (nodeHeight + padY),
    });
  });

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${colors.background}" rx="8"/>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${colors.edge}" />
    </marker>
  </defs>
`;

  const nodeColorMap: Record<string, string> = {
    file: colors.file || '#3b82f6',
    function: colors.function_ || '#8b5cf6',
    class: colors.class_ || '#ec4899',
    env: colors.env || '#eab308',
    external: colors.external || '#ef4444',
  };

  for (const node of nodes) {
    const pos = nodePositions.get(node.id);
    if (!pos) continue;
    const color = nodeColorMap[node.type] || colors.file || '#3b82f6';
    const label = escapeXML(node.label || node.id);
    const textLines = wrapText(label, nodeWidth - 16, fontSize);

    svg += `
  <g>
    <rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${Math.max(nodeHeight, fontSize * textLines.length + 24)}" rx="8" fill="${color}" opacity="0.9" stroke="${color}" stroke-width="1.5"/>
`;

    textLines.forEach((line, li) => {
      svg += `    <text x="${pos.x + nodeWidth / 2}" y="${pos.y + 20 + li * fontSize}" text-anchor="middle" fill="${colors.text}" font-family="monospace" font-size="${fontSize}">${line}</text>\n`;
    });

    svg += `  </g>\n`;
  }

  for (const edge of edges) {
    const fromPos = nodePositions.get(edge.from);
    const toPos = nodePositions.get(edge.to);
    if (!fromPos || !toPos) continue;

    const fx = fromPos.x + nodeWidth;
    const fy = fromPos.y + nodeHeight / 2;
    const tx = toPos.x;
    const ty = toPos.y + nodeHeight / 2;

    const edgeLabel = edge.type || '';
    const midX = (fx + tx) / 2;
    const midY = (fy + ty) / 2 - 8;

    svg += `  <line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="${colors.edge}" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.6"/>\n`;
    if (edgeLabel) {
      svg += `  <text x="${midX}" y="${midY}" text-anchor="middle" fill="${colors.edge}" font-size="9" font-family="monospace" opacity="0.7">${edgeLabel}</text>\n`;
    }
  }

  svg += '</svg>';
  return svg;
}

interface DOTGraph {
  nodes: { id: string; label: string; type: string }[];
  edges: { from: string; to: string; type: string }[];
}

function parseDOT(dot: string): DOTGraph | null {
  const nodes: DOTGraph['nodes'] = [];
  const edges: DOTGraph['edges'] = [];

  const nodeRegex = /"([^"]+)"\s*\[label="([^"]+)"(?:,\s*fillcolor=(\w+))?/g;
  let match;
  while ((match = nodeRegex.exec(dot)) !== null) {
    let type = 'file';
    if (match[3] === 'lightyellow') type = 'env';
    else if (match[3] === 'lightcoral') type = 'external';
    nodes.push({ id: match[1], label: match[2], type });
  }

  const edgeRegex = /"([^"]+)"\s*->\s*"([^"]+)"/g;
  while ((match = edgeRegex.exec(dot)) !== null) {
    edges.push({ from: match[1], to: match[2], type: 'imports' });
  }

  if (nodes.length === 0 && edges.length === 0) return null;
  return { nodes, edges };
}

export function buildSVGFromGraph(graph: DependencyGraph, options: SVGOptions = {}): string {
  const nodeWidth = options.nodeWidth || 150;
  const nodeHeight = options.nodeHeight || 45;
  const fontSize = options.fontSize || 12;
  const padX = 30;
  const padY = 50;
  const colors = { ...defaultColors, ...options.colors };

  const nodes = graph.nodes;
  const edges = graph.edges;

  const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
  const rows = Math.ceil(nodes.length / cols);
  const width = options.width || Math.max(800, cols * (nodeWidth + padX) + padX);
  const height = options.height || Math.max(600, rows * (nodeHeight + padY) + padY);

  const nodePositions: Map<string, { x: number; y: number }> = new Map();
  nodes.forEach((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    nodePositions.set(node.id, {
      x: padX + col * (nodeWidth + padX),
      y: padY + row * (nodeHeight + padY),
    });
  });

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="${colors.background}" rx="8"/>
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${colors.edge}" />
    </marker>
  </defs>
`;

  const nodeColorMap: Record<string, string> = {
    file: colors.file || '#3b82f6',
    function: colors.function_ || '#8b5cf6',
    class: colors.class_ || '#ec4899',
    env: colors.env || '#eab308',
    external: colors.external || '#ef4444',
  };

  for (const node of nodes) {
    const pos = nodePositions.get(node.id);
    if (!pos) continue;
    const color = nodeColorMap[node.type] || colors.file || '#3b82f6';
    const label = escapeXML(node.label || node.id);
    const textLines = wrapText(label, nodeWidth - 16, fontSize);

    svg += `  <g>
    <rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${Math.max(nodeHeight, fontSize * textLines.length + 24)}" rx="8" fill="${color}" opacity="0.9" stroke="${color}" stroke-width="1.5"/>\n`;

    textLines.forEach((line, li) => {
      svg += `    <text x="${pos.x + nodeWidth / 2}" y="${pos.y + 20 + li * fontSize}" text-anchor="middle" fill="${colors.text}" font-family="monospace" font-size="${fontSize}">${line}</text>\n`;
    });

    svg += `  </g>\n`;
  }

  for (const edge of edges) {
    const fromPos = nodePositions.get(edge.from);
    const toPos = nodePositions.get(edge.to);
    if (!fromPos || !toPos) continue;

    const fx = fromPos.x + nodeWidth;
    const fy = fromPos.y + nodeHeight / 2;
    const tx = toPos.x;
    const ty = toPos.y + nodeHeight / 2;

    const midX = (fx + tx) / 2;
    const midY = (fy + ty) / 2 - 8;

    svg += `  <line x1="${fx}" y1="${fy}" x2="${tx}" y2="${ty}" stroke="${colors.edge}" stroke-width="1.5" marker-end="url(#arrowhead)" opacity="0.6"/>\n`;
    svg += `  <text x="${midX}" y="${midY}" text-anchor="middle" fill="${colors.edge}" font-size="9" font-family="monospace" opacity="0.7">${edge.type || ''}</text>\n`;
  }

  svg += '</svg>';
  return svg;
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const approxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
  if (text.length <= approxCharsPerLine) return [text];

  const words = text.split(/(?=[A-Z\/_])/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length > approxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.length > 0 ? lines : [text];
}
