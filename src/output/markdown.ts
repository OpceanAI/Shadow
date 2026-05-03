import { ProjectInfo, DependencyGraph } from '../types';

export function projectInfoToMarkdown(info: ProjectInfo): string {
  const lines: string[] = [
    `# ${info.name}`,
    '',
    `**Language:** ${info.language}  `,
    `**Files:** ${info.totalFiles}  `,
    '',
    info.summary,
    '',
  ];

  if (info.entryPoints.length > 0) {
    lines.push('## Entry Points', '');
    info.entryPoints.forEach((ep) => lines.push(`- \`${ep}\``));
    lines.push('');
  }

  if (info.envVars.length > 0) {
    lines.push('## Environment Variables', '');
    info.envVars.forEach((v) => lines.push(`- \`${v}\``));
    lines.push('');
  }

  if (info.externalAPIs.length > 0) {
    lines.push('## External APIs', '');
    info.externalAPIs.forEach((api) => lines.push(`- ${api}`));
    lines.push('');
  }

  return lines.join('\n');
}

export function graphToMarkdown(graph: DependencyGraph): string {
  const lines: string[] = ['# Dependency Graph', ''];

  lines.push('| From | To | Type |');
  lines.push('|------|----|------|');

  for (const edge of graph.edges) {
    const fromLabel = graph.nodes.find((n) => n.id === edge.from)?.label || edge.from;
    const toLabel = graph.nodes.find((n) => n.id === edge.to)?.label || edge.to;
    lines.push(`| ${fromLabel} | ${toLabel} | ${edge.type} |`);
  }

  return lines.join('\n');
}
