import { definePlugin, createCommand, createPluginLogger, createAnalyzer } from '../../../src/plugin/sdk';
import { FileInfo } from '../../../src/types';

export default definePlugin({
  name: 'example',
  version: '1.0.0',
  description: 'Example Shadow plugin demonstrating all extension points',
  hooks: {
    async onInit() {
      const logger = createPluginLogger('example');
      logger.info('Initializing example plugin...');
      logger.success('Example plugin ready!');
    },
    async onAnalyze(project) {
      const logger = createPluginLogger('example');
      logger.info(`Analyzing project: ${project.name} (${project.totalFiles} files)`);
      logger.debug(`Entry points: ${project.entryPoints.join(', ')}`);
    },
    async onFix(proposal) {
      const logger = createPluginLogger('example');
      logger.info(`Fix proposed: ${proposal.title} (risk: ${proposal.risk})`);
    },
    async onCommit(message) {
      const logger = createPluginLogger('example');
      logger.info(`Committing: "${message.slice(0, 80)}"`);
    },
  },
  analyzers: [
    createAnalyzer(['typescript', 'javascript'], (code, filePath) => {
      const comments = (code.match(/\/\/\s*TODO.*$/gm) || []).length;
      const result: Partial<FileInfo> = {};
      if (comments > 0) {
        result.exports = [`TODOs found: ${comments}`];
      }
      return result;
    }),
  ],
  formatters: [
    {
      name: 'compact',
      format(data: unknown) {
        return JSON.stringify(data);
      },
    },
    {
      name: 'summary',
      format(data: unknown) {
        if (typeof data === 'object' && data !== null && 'name' in data) {
          return `Project: ${(data as Record<string, unknown>).name}`;
        }
        return typeof data === 'string' ? data.slice(0, 200) : 'unknown';
      },
    },
  ],
  commands: [
    createCommand('hello', 'Say hello from the example plugin', {
      aliases: ['hi'],
      options: [
        { flags: '--name <name>', description: 'Name to greet', defaultValue: 'World' },
        { flags: '--json', description: 'JSON output' },
      ],
      action(ctx) {
        const logger = createPluginLogger('example');
        const name = (ctx.options.name as string) || 'World';
        if (ctx.options.json) {
          console.log(JSON.stringify({ greeting: `Hello, ${name}!`, plugin: 'example' }));
        } else {
          logger.success(`Hello, ${name}!`);
        }
      },
    }),
    createCommand('todo-count', 'Count TODOs in the project', {
      action(ctx) {
        const logger = createPluginLogger('example');
        logger.info('TODO counting is available when project is analyzed.');
        logger.info('Run "shadow info" first to trigger analysis hooks.');
      },
    }),
    createCommand('health', 'Check example plugin health', {
      aliases: ['ping'],
      action(ctx) {
        const logger = createPluginLogger('example');
        logger.success('Example plugin is healthy!');
        logger.info(`Version: 1.0.0`);
        logger.info(`Capabilities: hooks, analyzers, formatters, commands`);
      },
    }),
  ],
});
