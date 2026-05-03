export interface YAMLConfigInfo {
  type: 'docker-compose' | 'kubernetes' | 'github-actions' | 'gitlab-ci' | 'circleci' | 'ansible' | 'helm' | 'unknown';
  services?: string[];
  volumes?: string[];
  networks?: string[];
  envVars?: string[];
  ports?: string[];
}

export function parseYAMLConfig(content: string, filePath: string): YAMLConfigInfo {
  const info: YAMLConfigInfo = { type: 'unknown' };

  if (filePath.includes('docker-compose') || content.includes('services:') && content.includes('image:')) {
    info.type = 'docker-compose';
    info.services = extractYAMLList(content, 'services');
    info.volumes = extractYAMLList(content, 'volumes');
    info.networks = extractYAMLList(content, 'networks');
    info.ports = extractConfigPorts(content);
    info.envVars = extractConfigEnvVars(content);
  } else if (content.includes('apiVersion:') && (content.includes('kind:') || content.includes('metadata:'))) {
    info.type = 'kubernetes';
  } else if (filePath.includes('.github/workflows') || (content.includes('on:') && content.includes('jobs:'))) {
    info.type = 'github-actions';
  } else if (filePath.includes('.gitlab-ci') || content.includes('stages:') && content.includes('script:')) {
    info.type = 'gitlab-ci';
  } else if (filePath.includes('.circleci')) {
    info.type = 'circleci';
  } else if (content.includes('hosts:') && content.includes('tasks:')) {
    info.type = 'ansible';
  } else if (content.includes('apiVersion:') && content.includes('Chart.yaml')) {
    info.type = 'helm';
  }

  return info;
}

export function parseTOMLConfig(content: string): { sections: string[]; keys: string[] } {
  const sections: string[] = [];
  const keys: string[] = [];

  const sectionRegex = /^\[([^\]]+)\]/gm;
  const keyRegex = /^(\w+)\s*=/gm;
  let match;

  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push(match[1]);
  }
  while ((match = keyRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }

  return { sections, keys };
}

export function extractYAMLList(content: string, key: string): string[] {
  const re = new RegExp(`^\\s*${key}:\\s*\\n((?:\\s+-\\s*.+\\n?)*)`, 'm');
  const match = content.match(re);
  if (!match) {
    const inlineRe = new RegExp(`^\\s*${key}:\\s*\\[([^\\]]+)\\]`, 'm');
    const inlineMatch = content.match(inlineRe);
    if (inlineMatch) {
      return inlineMatch[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
    }
    return [];
  }

  const items: string[] = [];
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      items.push(trimmed.slice(2).trim().replace(/['"]/g, ''));
    }
  }
  return items;
}

function extractConfigPorts(content: string): string[] {
  const ports: string[] = [];
  const portRegex = /-?\s*["']?(\d+):\d+/g;
  const expReg = /expose:\s*\n((?:\s*-\s*["']?\d+["']?\s*\n?)*)/g;
  let match;
  while ((match = portRegex.exec(content)) !== null) {
    ports.push(match[1]);
  }
  return ports;
}

function extractConfigEnvVars(content: string): string[] {
  const vars: string[] = [];
  const envRegex = /-?\s*(\w+)=/g;
  const envSectionRegex = /environment:\s*\n((?:\s*[- ]?\s*\w+=.+\n?)*)/g;
  let match;
  while ((match = envSectionRegex.exec(content)) !== null) {
    for (const line of match[1].split('\n')) {
      const keyMatch = line.match(/^\s*[- ]?\s*(\w+)=/);
      if (keyMatch) vars.push(keyMatch[1]);
    }
  }
  return vars;
}
