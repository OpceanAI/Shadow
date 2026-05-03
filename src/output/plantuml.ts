import { DependencyGraph, GraphNode, GraphEdge } from '../types';

export function graphToPlantUML(graph: DependencyGraph, title?: string): string {
  const lines: string[] = [];

  lines.push('@startuml');
  if (title) lines.push(`title ${title}`);

  lines.push('skinparam backgroundColor #1e1e2e');
  lines.push('skinparam defaultTextColor #cdd6f4');
  lines.push('skinparam arrowColor #6b7280');
  lines.push('');

  const nodeDefs: string[] = [];
  const groups: Record<string, string[]> = {};

  for (const node of graph.nodes) {
    const alias = sanitizeAlias(node.id);
    const label = escapePUML(node.label);
    const def = getNodeDef(alias, label, node.type);
    nodeDefs.push(def);

    if (!groups[node.type]) groups[node.type] = [];
    groups[node.type].push(alias);
  }

  for (const [group, members] of Object.entries(groups)) {
    if (members.length > 0) {
      const groupColor = getGroupColor(group);
      lines.push(`package "${group}" ${groupColor} {`);
      for (const member of members) {
        const existing = nodeDefs.find((d) => d.startsWith(getNodePrefix(group) + ' ' + member));
        if (existing) {
          lines.push(`  ${existing.split(' as ')[1] || existing}`);
        }
      }
      lines.push('}');
      lines.push('');
    }
  }

  if (Object.keys(groups).length === 0) {
    for (const def of nodeDefs) {
      lines.push(def);
    }
    lines.push('');
  }

  for (const edge of graph.edges) {
    const fromAlias = sanitizeAlias(edge.from);
    const toAlias = sanitizeAlias(edge.to);
    const edgeStyle = getPUMLineStyle(edge.type);
    lines.push(`${fromAlias} ${edgeStyle} ${toAlias} : ${edge.type}`);
  }

  lines.push('@enduml');
  return lines.join('\n');
}

export function projectToPlantUML(
  files: { path: string; imports: { name: string; type: string }[]; language?: string; functions?: string[] }[],
  title?: string
): string {
  const lines: string[] = ['@startuml'];
  if (title) lines.push(`title ${title}`);
  lines.push('skinparam backgroundColor #FFFFFF');
  lines.push('');

  const fileAliases = new Map<string, string>();
  for (const file of files) {
    const alias = sanitizeAlias(file.path);
    fileAliases.set(file.path, alias);
    const fileName = file.path.split('/').pop() || file.path;
    lines.push(`[${escapePUML(fileName)}] as ${alias}`);

    if (file.functions) {
      for (const fn of file.functions) {
        const fnAlias = sanitizeAlias(`${file.path}:${fn}`);
        lines.push(`  () ${escapePUML(fn)} as ${fnAlias}`);
        lines.push(`  ${alias} --> ${fnAlias}`);
      }
    }
  }

  lines.push('');

  for (const file of files) {
    const fromAlias = fileAliases.get(file.path);
    if (!fromAlias) continue;
    for (const imp of file.imports) {
      if (imp.type === 'internal') {
        const toAlias = fileAliases.get(imp.name);
        if (toAlias) {
          lines.push(`${fromAlias} --> ${toAlias} : imports`);
        }
      }
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}

export function classDiagramToPlantUML(
  classes: { name: string; fields: string[]; methods: string[]; extends?: string; implements?: string[] }[],
  title?: string
): string {
  const lines: string[] = ['@startuml'];
  if (title) lines.push(`title ${title}`);
  lines.push('skinparam backgroundColor #FFFFFF');
  lines.push('');

  for (const cls of classes) {
    lines.push(`class ${escapePUML(cls.name)} {`);
    for (const field of cls.fields) {
      lines.push(`  ${escapePUML(field)}`);
    }
    for (const method of cls.methods) {
      lines.push(`  ${escapePUML(method)}()`);
    }
    lines.push('}');
    lines.push('');

    if (cls.extends) {
      lines.push(`${escapePUML(cls.extends)} <|-- ${escapePUML(cls.name)}`);
    }
    if (cls.implements) {
      for (const iface of cls.implements) {
        lines.push(`${escapePUML(iface)} <|.. ${escapePUML(cls.name)}`);
      }
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}

export function sequenceDiagramToPlantUML(
  participants: string[],
  messages: { from: string; to: string; label: string; type?: 'sync' | 'async' | 'return' }[],
  title?: string
): string {
  const lines: string[] = ['@startuml'];
  if (title) lines.push(`title ${title}`);
  lines.push('');

  for (const p of participants) {
    lines.push(`participant "${escapePUML(p)}" as ${sanitizeAlias(p)}`);
  }
  lines.push('');

  for (const msg of messages) {
    const from = sanitizeAlias(msg.from);
    const to = sanitizeAlias(msg.to);
    const arrow = msg.type === 'async' ? '->>' : msg.type === 'return' ? '-->' : '->';
    lines.push(`${from} ${arrow} ${to} : ${escapePUML(msg.label)}`);
  }

  lines.push('@enduml');
  return lines.join('\n');
}

function sanitizeAlias(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '_').replace(/^(\d)/, 'n$1') || 'node';
}

function escapePUML(str: string): string {
  return str.replace(/"/g, "'").replace(/\n/g, ' ');
}

function getNodeDef(alias: string, label: string, type: string): string {
  switch (type) {
    case 'env':
      return `database ${alias} as "${escapePUML(label)}"`;
    case 'external':
      return `cloud ${alias} as "${escapePUML(label)}"`;
    case 'function':
      return `() ${alias} as "${escapePUML(label)}"`;
    case 'class':
      return `class ${alias} as "${escapePUML(label)}"`;
    default:
      return `[${escapePUML(label)}] as ${alias}`;
  }
}

function getNodePrefix(type: string): string {
  switch (type) {
    case 'env': return 'database';
    case 'external': return 'cloud';
    case 'function': return '()';
    default: return 'rectangle';
  }
}

function getGroupColor(type: string): string {
  switch (type) {
    case 'file': return '#aliceblue';
    case 'env': return '#lightyellow';
    case 'external': return '#lightcoral';
    case 'function': return '#lavender';
    default: return '#whitesmoke';
  }
}

function getPUMLineStyle(type: string): string {
  switch (type) {
    case 'imports': return '-->';
    case 'calls': return '->';
    case 'references': return '.>';
    case 'reads_env': return '..>';
    case 'network': return '->';
    default: return '-->';
  }
}
