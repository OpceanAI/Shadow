import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from '../core/config';
import { pluginRegistry } from '../plugin/registry';
import { loadPlugins } from '../plugin/loader';
import {
  listPlugins,
  searchPlugins,
  getPluginInfo,
  installPlugin,
  uninstallPlugin,
} from '../plugin/marketplace';
import { printJSON } from '../output/json';

export function pluginCommand(program: Command): void {
  const plugin = program
    .command('plugin')
    .description('Manage Shadow plugins');

  plugin
    .command('list')
    .description('List installed plugins')
    .option('--all', 'Show all available plugins (including from marketplace)')
    .option('--json', 'JSON output')
    .action(async (options) => {
      await loadPlugins({ silent: true });

      const entries = options.all
        ? listPlugins()
        : listPlugins({ installed: true });

      if (options.json) {
        printJSON({ plugins: entries.map((e) => ({ name: e.name, version: e.version, installed: e.installed })) });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow plugins]\n'));

      const installedCount = entries.filter((e) => e.installed).length;

      if (entries.length === 0) {
        console.log(chalk.dim('  No plugins installed.'));
        console.log(chalk.dim(`  Use "${chalk.cyan('shadow plugin search <query>')}" to find plugins.`));
        console.log(chalk.dim(`  Use "${chalk.cyan('shadow plugin install <name>')}" to install one.`));
        console.log('');
        return;
      }

      console.log(chalk.dim(`  ${installedCount} installed\n`));

      for (const entry of entries) {
        const status = entry.installed ? chalk.green('installed') : chalk.dim('available');
        console.log(`  ${chalk.bold(entry.name)} ${chalk.dim(`v${entry.version}`)} ${chalk.dim(`[${status}]`)}`);
        console.log(`    ${chalk.dim(entry.description)}`);
        if (entry.tags.length > 0) {
          console.log(`    ${chalk.dim('Tags:')} ${entry.tags.map((t) => chalk.blue(t)).join(', ')}`);
        }
        console.log('');
      }
    });

  plugin
    .command('search <query>')
    .description('Search the plugin marketplace')
    .option('--json', 'JSON output')
    .action(async (query, options) => {
      await loadPlugins({ silent: true });
      const results = searchPlugins(query);

      if (options.json) {
        printJSON({ query, plugins: results.map((e) => ({ name: e.name, version: e.version, installed: e.installed })) });
        return;
      }

      console.log(chalk.bold.blue(`\n[shadow plugins: search "${query}"]\n`));
      console.log(chalk.dim(`  ${results.length} results\n`));

      if (results.length === 0) {
        console.log(chalk.dim('  No plugins found matching your query.'));
        console.log('');
        return;
      }

      for (const entry of results) {
        const status = entry.installed ? chalk.green('installed') : chalk.dim('not installed');
        console.log(`  ${chalk.bold(entry.name)} ${chalk.dim(`v${entry.version}`)} ${chalk.dim(`[${status}]`)}`);
        console.log(`    ${chalk.dim(entry.description)}`);
        console.log(`    ${chalk.dim('Author:')} ${entry.author}`);
        console.log(`    ${chalk.dim('Tags:')} ${entry.tags.map((t) => chalk.blue(t)).join(', ')}`);
        console.log('');
      }
    });

  plugin
    .command('install <name>')
    .description('Install a plugin from the marketplace')
    .option('--json', 'JSON output')
    .action(async (name, options) => {
      await loadPlugins({ silent: true });
      const success = await installPlugin(name);

      if (options.json) {
        printJSON({ action: 'install', plugin: name, success });
        return;
      }

      // installPlugin already prints
    });

  plugin
    .command('remove <name>')
    .description('Remove an installed plugin')
    .option('--json', 'JSON output')
    .action(async (name, options) => {
      await loadPlugins({ silent: true });
      const success = await uninstallPlugin(name);

      if (options.json) {
        printJSON({ action: 'remove', plugin: name, success });
        return;
      }

      // uninstallPlugin already prints
    });

  plugin
    .command('info <name>')
    .description('Show plugin details')
    .option('--json', 'JSON output')
    .action(async (name, options) => {
      await loadPlugins({ silent: true });
      const registered = pluginRegistry.get(name);
      const marketplace = getPluginInfo(name);

      if (options.json) {
        printJSON({
          plugin: name,
          installed: !!registered,
          version: registered?.version || marketplace?.version || 'unknown',
          description: registered?.description || marketplace?.description || '',
          marketEntry: marketplace || null,
        });
        return;
      }

      console.log(chalk.bold.blue(`\n[shadow plugin: ${name}]\n`));

      if (registered) {
        console.log(`  ${chalk.bold('Status:')} ${chalk.green('Installed')}`);
        console.log(`  ${chalk.bold('Version:')} ${registered.version}`);
        console.log(`  ${chalk.bold('Description:')} ${registered.description}`);
        if (registered.hooks) {
          const hookNames = Object.keys(registered.hooks).filter((k) => typeof (registered.hooks as Record<string, unknown>)[k] === 'function');
          if (hookNames.length > 0) {
            console.log(`  ${chalk.bold('Hooks:')} ${hookNames.join(', ')}`);
          }
        }
        if (registered.commands && registered.commands.length > 0) {
          console.log(`  ${chalk.bold('Commands:')} ${registered.commands.map((c) => c.name).join(', ')}`);
        }
        if (registered.analyzers && registered.analyzers.length > 0) {
          console.log(`  ${chalk.bold('Analyzers:')} ${registered.analyzers.map((a) => a.languages.join('/')).join(', ')}`);
        }
        if (registered.formatters && registered.formatters.length > 0) {
          console.log(`  ${chalk.bold('Formatters:')} ${registered.formatters.map((f) => f.name).join(', ')}`);
        }
      } else if (marketplace) {
        console.log(`  ${chalk.bold('Status:')} ${chalk.dim('Not installed')}`);
        console.log(`  ${chalk.bold('Version:')} ${marketplace.version}`);
        console.log(`  ${chalk.bold('Description:')} ${marketplace.description}`);
        console.log(`  ${chalk.bold('Author:')} ${marketplace.author}`);
        console.log(`  ${chalk.bold('Repository:')} ${marketplace.repository}`);
        console.log(`  ${chalk.bold('Tags:')} ${marketplace.tags.join(', ')}`);
      } else {
        console.log(chalk.yellow(`  Plugin "${name}" not found.`));
        console.log(chalk.dim(`  Use "shadow plugin search <query>" to find plugins.`));
      }

      console.log('');
    });

  plugin
    .command('init')
    .description('Initialize a new Shadow plugin project')
    .option('--name <name>', 'Plugin name')
    .option('--description <desc>', 'Plugin description')
    .action(async (options) => {
      const name = options.name || 'my-plugin';
      const description = options.description || 'A Shadow plugin';

      console.log(chalk.bold.blue('\n[shadow plugin init]\n'));
      console.log(chalk.dim(`  Creating plugin: ${name}\n`));

      console.log(chalk.cyan('  Template: definePlugin({...})'));
      console.log(chalk.cyan('  Entry: plugin.ts'));
      console.log(chalk.cyan('  SDK: import { definePlugin, createCommand } from "shadow/plugin/sdk"\n'));

      console.log(chalk.dim('  Example plugin structure:'));
      console.log(chalk.dim('  ────────────────────────────'));
      console.log('');
      console.log(chalk.white("  import { definePlugin, createCommand, createPluginLogger } from 'shadow/plugin/sdk';"));
      console.log('');
      console.log(chalk.white('  export default definePlugin({'));
      console.log(chalk.white(`    name: '${name}',`));
      console.log(chalk.white("    version: '0.1.0',"));
      console.log(chalk.white(`    description: '${description}',`));
      console.log(chalk.white('    hooks: {'));
      console.log(chalk.white('      async onInit() {'));
      console.log(chalk.white(`        console.log('${name} initialized');`));
      console.log(chalk.white('      },'));
      console.log(chalk.white('    },'));
      console.log(chalk.white('    commands: ['));
      console.log(chalk.white("      createCommand('hello', 'Say hello', {"));
      console.log(chalk.white('        action(ctx) {'));
      console.log(chalk.white("          ctx.logger.success('Hello from my plugin!');"));
      console.log(chalk.white('        },'));
      console.log(chalk.white('      }),'));
      console.log(chalk.white('    ],'));
      console.log(chalk.white('  });'));
      console.log('');
    });
}
