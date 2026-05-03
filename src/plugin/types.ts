import { ProjectInfo, FileInfo, FixProposal } from '../types';

export interface ShadowPlugin {
  name: string;
  version: string;
  description: string;
  commands?: ShadowCommand[];
  hooks?: PluginHooks;
  analyzers?: CustomAnalyzer[];
  formatters?: CustomFormatter[];
}

export interface PluginHooks {
  onInit?(): Promise<void>;
  onAnalyze?(project: ProjectInfo): Promise<void>;
  onFix?(proposal: FixProposal): Promise<void>;
  onCommit?(message: string): Promise<void>;
}

export interface CustomAnalyzer {
  languages: string[];
  analyze(code: string, filePath: string): Partial<FileInfo>;
}

export interface CustomFormatter {
  name: string;
  format(data: unknown): string;
}

export interface ShadowCommand {
  name: string;
  description: string;
  options?: CommandOption[];
  aliases?: string[];
  subcommands?: ShadowCommand[];
  action(context: PluginCommandContext): Promise<void> | void;
}

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: string | boolean | number;
}

export interface PluginCommandContext {
  args: string[];
  options: Record<string, unknown>;
  config: Record<string, unknown>;
  logger: PluginLogger;
}

export interface PluginLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  success(msg: string): void;
  debug(msg: string): void;
}

export interface MarketplaceEntry {
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string;
  tags: string[];
  downloads: number;
  installed: boolean;
  latestVersion: string;
}
