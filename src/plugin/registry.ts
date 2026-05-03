import { ShadowPlugin, PluginHooks, CustomAnalyzer, CustomFormatter, ShadowCommand, PluginCommandContext } from './types';
import { ProjectInfo, FileInfo, FixProposal } from '../types';
import chalk from 'chalk';

export class PluginRegistry {
  private plugins: Map<string, ShadowPlugin> = new Map();
  private commandOverrides: Map<string, ShadowCommand> = new Map();
  private allAnalyzers: CustomAnalyzer[] = [];
  private allFormatters: Map<string, CustomFormatter> = new Map();
  private hookPipeline: Required<PluginHooks>[] = [];

  register(plugin: ShadowPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(chalk.yellow(`Plugin "${plugin.name}" is already registered. Skipping.`));
      return;
    }

    this.plugins.set(plugin.name, plugin);

    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        const fullName = `${plugin.name}:${cmd.name}`;
        this.commandOverrides.set(fullName, cmd);
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.commandOverrides.set(`${plugin.name}:${alias}`, cmd);
          }
        }
      }
    }

    if (plugin.analyzers) {
      this.allAnalyzers.push(...plugin.analyzers);
    }

    if (plugin.formatters) {
      for (const formatter of plugin.formatters) {
        this.allFormatters.set(`${plugin.name}:${formatter.name}`, formatter);
      }
    }

    if (plugin.hooks) {
      this.hookPipeline.push({
        onInit: plugin.hooks.onInit || emptyHook,
        onAnalyze: plugin.hooks.onAnalyze || emptyAnalyzeHook,
        onFix: plugin.hooks.onFix || emptyFixHook,
        onCommit: plugin.hooks.onCommit || emptyCommitHook,
      });
    }
  }

  unregister(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        const fullName = `${plugin.name}:${cmd.name}`;
        this.commandOverrides.delete(fullName);
        if (cmd.aliases) {
          for (const alias of cmd.aliases) {
            this.commandOverrides.delete(`${plugin.name}:${alias}`);
          }
        }
      }
    }

    if (plugin.analyzers) {
      this.allAnalyzers = this.allAnalyzers.filter(
        (a) => !plugin.analyzers!.includes(a)
      );
    }

    if (plugin.formatters) {
      for (const formatter of plugin.formatters) {
        this.allFormatters.delete(`${plugin.name}:${formatter.name}`);
      }
    }

    this.hookPipeline = this.hookPipeline.filter((_, i) => {
      const registered = this.getRegistered();
      const pluginName = registered[i]?.name;
      return pluginName !== name;
    });

    this.plugins.delete(name);
    return true;
  }

  get(name: string): ShadowPlugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): ShadowPlugin[] {
    return Array.from(this.plugins.values());
  }

  getCommand(fullName: string): ShadowCommand | undefined {
    return this.commandOverrides.get(fullName);
  }

  getAllCommands(): Map<string, ShadowCommand> {
    return new Map(this.commandOverrides);
  }

  getAnalyzers(): CustomAnalyzer[] {
    return [...this.allAnalyzers];
  }

  getAnalyzerForLanguage(language: string): CustomAnalyzer | undefined {
    return this.allAnalyzers.find((a) => a.languages.includes(language));
  }

  getFormatter(fullName: string): CustomFormatter | undefined {
    return this.allFormatters.get(fullName);
  }

  getAllFormatters(): Map<string, CustomFormatter> {
    return new Map(this.allFormatters);
  }

  async executeInitHooks(): Promise<void> {
    for (const hooks of this.hookPipeline) {
      await hooks.onInit();
    }
  }

  async executeAnalyzeHooks(project: ProjectInfo): Promise<void> {
    for (const hooks of this.hookPipeline) {
      await hooks.onAnalyze(project);
    }
  }

  async executeFixHooks(proposal: FixProposal): Promise<void> {
    for (const hooks of this.hookPipeline) {
      await hooks.onFix(proposal);
    }
  }

  async executeCommitHooks(message: string): Promise<void> {
    for (const hooks of this.hookPipeline) {
      await hooks.onCommit(message);
    }
  }

  getRegistered(): ShadowPlugin[] {
    return this.getAll();
  }
}

async function emptyHook(): Promise<void> {}
async function emptyAnalyzeHook(_project: ProjectInfo): Promise<void> {}
async function emptyFixHook(_proposal: FixProposal): Promise<void> {}
async function emptyCommitHook(_message: string): Promise<void> {}

export const pluginRegistry = new PluginRegistry();
