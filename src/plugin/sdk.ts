import { ShadowPlugin, ShadowCommand, CustomAnalyzer, CustomFormatter, CommandOption, PluginCommandContext, PluginLogger } from './types';
import { PluginRegistry, pluginRegistry } from './registry';
import { FileInfo } from '../types';
import chalk from 'chalk';
import { loadConfig } from '../core/config';

export function definePlugin(definition: Partial<ShadowPlugin> & Pick<ShadowPlugin, 'name' | 'version'>): ShadowPlugin {
  return {
    name: definition.name,
    version: definition.version,
    description: definition.description || '',
    commands: definition.commands,
    hooks: definition.hooks,
    analyzers: definition.analyzers,
    formatters: definition.formatters,
  };
}

export function createCommand(
  name: string,
  description: string,
  config: {
    options?: CommandOption[];
    aliases?: string[];
    subcommands?: ShadowCommand[];
    action: (ctx: PluginCommandContext) => Promise<void> | void;
  },
): ShadowCommand {
  return {
    name,
    description,
    options: config.options,
    aliases: config.aliases,
    subcommands: config.subcommands,
    action: config.action,
  };
}

export function createAnalyzer(
  languages: string[],
  analyze: (code: string, filePath: string) => Partial<FileInfo>,
): CustomAnalyzer {
  return { languages, analyze };
}

export function createFormatter(
  name: string,
  format: (data: unknown) => string,
): CustomFormatter {
  return { name, format };
}

export function createPluginLogger(pluginName: string): PluginLogger {
  const prefix = chalk.dim(`[${pluginName}]`);
  return {
    info(msg: string) {
      console.log(`${prefix} ${chalk.blue(msg)}`);
    },
    warn(msg: string) {
      console.warn(`${prefix} ${chalk.yellow(msg)}`);
    },
    error(msg: string) {
      console.error(`${prefix} ${chalk.red(msg)}`);
    },
    success(msg: string) {
      console.log(`${prefix} ${chalk.green(msg)}`);
    },
    debug(msg: string) {
      if (process.env.SHADOW_DEBUG) {
        console.log(`${prefix} ${chalk.gray(msg)}`);
      }
    },
  };
}

export function getPluginRegistry(): PluginRegistry {
  return pluginRegistry;
}

export function getShadowConfig() {
  return loadConfig();
}
