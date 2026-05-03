export interface DockerfileInfo {
  baseImages: string[];
  stages: DockerfileStage[];
  exposedPorts: number[];
  envVars: string[];
  volumes: string[];
  copyCommands: string[];
  runCommands: string[];
  entrypoint?: string;
  cmd?: string;
  user?: string;
  workdir?: string;
}

export interface DockerfileStage {
  name: string;
  baseImage: string;
  alias?: string;
}

export function parseDockerfile(content: string): DockerfileInfo {
  const lines = content.split('\n');
  const info: DockerfileInfo = {
    baseImages: [],
    stages: [],
    exposedPorts: [],
    envVars: [],
    volumes: [],
    copyCommands: [],
    runCommands: [],
  };

  let currentStage: DockerfileStage | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = splitDockerfileLine(trimmed);
    const instruction = parts[0].toUpperCase();

    switch (instruction) {
      case 'FROM': {
        const baseImage = parts[1];
        const aliasMatch = line.match(/\s+AS\s+(\w+)/i);
        const stageName = aliasMatch ? aliasMatch[1] : `stage${info.stages.length}`;
        currentStage = { name: stageName, baseImage, alias: aliasMatch?.[1] };
        info.stages.push(currentStage);
        info.baseImages.push(baseImage);
        break;
      }
      case 'EXPOSE': {
        const port = parseInt(parts[1], 10);
        if (!isNaN(port)) info.exposedPorts.push(port);
        break;
      }
      case 'ENV': {
        const eqMatch = parts[1]?.match(/^(\w+)=/);
        if (eqMatch) {
          info.envVars.push(eqMatch[1]);
        } else {
          info.envVars.push(parts[1]);
        }
        break;
      }
      case 'VOLUME':
        info.volumes.push(parts.slice(1).join(' '));
        break;
      case 'COPY':
      case 'ADD':
        info.copyCommands.push(parts.slice(1).join(' '));
        break;
      case 'RUN':
        info.runCommands.push(parts.slice(1).join(' '));
        break;
      case 'ENTRYPOINT':
        info.entrypoint = parts.slice(1).join(' ');
        break;
      case 'CMD':
        info.cmd = parts.slice(1).join(' ');
        break;
      case 'USER':
        info.user = parts[1];
        break;
      case 'WORKDIR':
        info.workdir = parts[1];
        break;
    }
  }

  return info;
}

function splitDockerfileLine(line: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of line) {
    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
    } else if (!inQuote && (char === ' ' || char === '\t')) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) parts.push(current);
  return parts;
}

export function analyzeDockerfileQuality(info: DockerfileInfo): string[] {
  const tips: string[] = [];

  if (info.stages.length > 1) {
    tips.push('Uses multi-stage builds (good for image size optimization)');
  }
  if (info.runCommands.some((cmd) => cmd.includes('apt-get') && !cmd.includes('rm -rf /var/lib/apt'))) {
    tips.push('Consider cleaning apt cache after installs to reduce layer size');
  }
  if (info.baseImages.some((img) => img.includes('alpine'))) {
    tips.push('Using Alpine-based images (smaller footprint)');
  }
  if (info.copyCommands.length > 3) {
    tips.push('Multiple COPY commands - consider consolidating for fewer layers');
  }
  if (!info.user || info.user === 'root') {
    tips.push('Consider running as non-root user for security (USER directive)');
  }
  if (info.exposedPorts.length === 0 && !info.cmd?.includes('port')) {
    tips.push('No EXPOSE directive found - may need to declare service ports');
  }

  return tips;
}
