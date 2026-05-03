export function loadAliases(aliases?: Record<string, string>): Record<string, string> {
  if (!aliases) return {};

  const resolved: Record<string, string> = {};
  const visited = new Set<string>();

  for (const [alias, target] of Object.entries(aliases)) {
    resolved[alias] = resolveAlias(alias, target, aliases, visited, 0);
  }

  return resolved;
}

function resolveAlias(
  name: string,
  target: string,
  aliases: Record<string, string>,
  visited: Set<string>,
  depth: number,
): string {
  if (depth > 10) {
    throw new Error(`Alias resolution exceeded max depth for "${name}"`);
  }

  if (visited.has(name)) {
    throw new Error(`Circular alias detected: ${Array.from(visited).join(' -> ')} -> ${name}`);
  }

  visited.add(name);

  const parts = target.trim().split(/\s+/);
  const cmdName = parts[0];
  const cmdArgs = parts.slice(1).join(' ');

  if (aliases[cmdName]) {
    const resolvedTarget = resolveAlias(cmdName, aliases[cmdName], aliases, visited, depth + 1);
    const resolvedParts = resolvedTarget.trim().split(/\s+/);
    const resolvedCmd = resolvedParts[0];
    const resolvedArgs = resolvedParts.slice(1).join(' ');
    const combinedArgs = [resolvedArgs, cmdArgs].filter(Boolean).join(' ');
    return combinedArgs ? `${resolvedCmd} ${combinedArgs}` : resolvedCmd;
  }

  return target;
}

export function resolveAliasChain(
  alias: string,
  aliases: Record<string, string>,
): { command: string; args: string[] } {
  const resolved = aliases[alias] || alias;
  const parts = resolved.trim().split(/\s+/);
  return {
    command: parts[0],
    args: parts.slice(1),
  };
}
