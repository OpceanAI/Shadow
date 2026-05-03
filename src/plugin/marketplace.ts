import * as fs from 'fs';
import * as path from 'path';
import { MarketplaceEntry } from './types';
import { pluginRegistry } from './registry';
import chalk from 'chalk';

const MARKETPLACE_CACHE_FILE = path.join(process.cwd(), '.shadow', 'cache', 'plugin-registry.json');

const CORE_PLUGINS: MarketplaceEntry[] = [
  {
    name: 'sonarqube',
    version: '0.1.0',
    description: 'SonarQube integration for code quality analysis',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/sonarqube',
    tags: ['quality', 'analysis', 'sonarqube', 'lint'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'jira',
    version: '0.1.0',
    description: 'Jira integration for issue tracking',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/jira',
    tags: ['issue', 'tracking', 'jira', 'project-management'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'codecov',
    version: '0.1.0',
    description: 'Codecov integration for test coverage reporting',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/codecov',
    tags: ['coverage', 'testing', 'codecov', 'reports'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'datadog',
    version: '0.1.0',
    description: 'Datadog integration for monitoring and APM',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/datadog',
    tags: ['monitoring', 'apm', 'datadog', 'observability'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'eslint',
    version: '0.1.0',
    description: 'ESLint integration for JavaScript/TypeScript linting',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/eslint',
    tags: ['lint', 'javascript', 'typescript', 'eslint'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'prettier',
    version: '0.1.0',
    description: 'Prettier integration for code formatting',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/prettier',
    tags: ['format', 'prettier', 'style'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'slack',
    version: '0.1.0',
    description: 'Slack notifications for Shadow events',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/slack',
    tags: ['notification', 'slack', 'communication'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
  {
    name: 'github-actions',
    version: '0.1.0',
    description: 'GitHub Actions CI integration',
    author: 'shadow-plugins',
    repository: 'https://github.com/shadow-plugins/github-actions',
    tags: ['ci', 'github', 'actions', 'devops'],
    downloads: 0,
    installed: false,
    latestVersion: '0.1.0',
  },
];

export function listPlugins(options?: { installed?: boolean }): MarketplaceEntry[] {
  const installed = pluginRegistry.getAll().map((p) => p.name);
  const entries = CORE_PLUGINS.map((e) => ({
    ...e,
    installed: installed.includes(e.name),
  }));

  if (options?.installed) {
    return entries.filter((e) => e.installed);
  }

  return entries;
}

export function searchPlugins(query: string): MarketplaceEntry[] {
  const lower = query.toLowerCase();
  const installed = pluginRegistry.getAll().map((p) => p.name);

  return CORE_PLUGINS.filter((e) => {
    const matches =
      e.name.toLowerCase().includes(lower) ||
      e.description.toLowerCase().includes(lower) ||
      e.tags.some((t) => t.toLowerCase().includes(lower));
    return matches;
  }).map((e) => ({
    ...e,
    installed: installed.includes(e.name),
  }));
}

export function getPluginInfo(name: string): MarketplaceEntry | undefined {
  const entry = CORE_PLUGINS.find((e) => e.name === name);
  if (!entry) return undefined;

  const installed = pluginRegistry.getAll().some((p) => p.name === name);
  return { ...entry, installed };
}

export async function installPlugin(name: string): Promise<boolean> {
  const entry = CORE_PLUGINS.find((e) => e.name === name);
  if (!entry) {
    console.error(chalk.red(`Plugin "${name}" not found in marketplace.`));
    return false;
  }

  const installed = pluginRegistry.getAll().some((p) => p.name === name);
  if (installed) {
    console.log(chalk.yellow(`Plugin "${name}" is already installed.`));
    return true;
  }

  const localPath = path.join(process.cwd(), '.shadow', 'plugins', name);
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }

  const stubContent = generateStubPlugin(name, entry.description);
  fs.writeFileSync(path.join(localPath, 'plugin.ts'), stubContent, 'utf-8');

  const pkgJson = {
    name: `shadow-plugin-${name}`,
    version: entry.version,
    description: entry.description,
    shadow: {
      type: 'plugin',
      main: 'plugin.ts',
    },
  };
  fs.writeFileSync(path.join(localPath, 'plugin.json'), JSON.stringify(pkgJson, null, 2), 'utf-8');

  console.log(chalk.green(`Installed plugin "${name}"@${entry.version}`));
  console.log(chalk.dim(`  Location: ${localPath}`));
  return true;
}

export async function uninstallPlugin(name: string): Promise<boolean> {
  pluginRegistry.unregister(name);

  const localPath = path.join(process.cwd(), '.shadow', 'plugins', name);
  if (fs.existsSync(localPath)) {
    try {
      fs.rmSync(localPath, { recursive: true, force: true });
    } catch {
      console.warn(chalk.yellow(`Could not remove plugin directory: ${localPath}`));
    }
  }

  console.log(chalk.green(`Uninstalled plugin "${name}"`));
  return true;
}

function generateStubPlugin(name: string, description: string): string {
  return `import { definePlugin, createCommand, createPluginLogger } from '../../../src/plugin/sdk';

export default definePlugin({
  name: '${name}',
  version: '0.1.0',
  description: '${description}',
  hooks: {
    async onInit() {
      const logger = createPluginLogger('${name}');
      logger.info('Plugin initialized');
    },
    async onAnalyze(project) {
      const logger = createPluginLogger('${name}');
      logger.info(\`Analyzing project: \${project.name}\`);
    },
  },
  commands: [
    createCommand('status', 'Show ${name} integration status', {
      action(ctx) {
        const logger = createPluginLogger('${name}');
        logger.info('Status check...');
        logger.success('Integration is active');
      },
    }),
  ],
});
`;
}
