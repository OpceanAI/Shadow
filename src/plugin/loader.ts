import * as fs from 'fs';
import * as path from 'path';
import { ShadowPlugin } from './types';
import { pluginRegistry } from './registry';
import { loadConfig } from '../core/config';
import chalk from 'chalk';

interface LoadOptions {
  silent?: boolean;
}

export async function loadPlugins(options: LoadOptions = {}): Promise<ShadowPlugin[]> {
  const loaded: ShadowPlugin[] = [];
  const config = loadConfig();

  const nodeModulesPlugins = scanNodeModulesPlugins();
  const localPlugins = scanLocalPlugins(config);

  const allPaths = [...nodeModulesPlugins, ...localPlugins];

  for (const pluginPath of allPaths) {
    try {
      const plugin = await loadPluginFromPath(pluginPath);
      if (plugin) {
        if (isPluginEnabled(plugin, config)) {
          pluginRegistry.register(plugin);
          loaded.push(plugin);
          if (!options.silent) {
            console.log(chalk.dim(`  Loaded plugin: ${plugin.name}@${plugin.version}`));
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!options.silent) {
        console.warn(chalk.yellow(`  Failed to load plugin from "${pluginPath}": ${message}`));
      }
    }
  }

  await pluginRegistry.executeInitHooks();
  return loaded;
}

function scanNodeModulesPlugins(): string[] {
  const results: string[] = [];
  const nodeModulesDir = findNodeModules();

  if (!nodeModulesDir || !fs.existsSync(nodeModulesDir)) return results;

  try {
    const entries = fs.readdirSync(nodeModulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        (entry.name.startsWith('@shadow/plugin-') || entry.name.startsWith('shadow-plugin-'))
      ) {
        results.push(path.join(nodeModulesDir, entry.name));
      }
    }

    const scopedDir = path.join(nodeModulesDir, '@shadow');
    if (fs.existsSync(scopedDir)) {
      const scopedEntries = fs.readdirSync(scopedDir, { withFileTypes: true });
      for (const entry of scopedEntries) {
        if (entry.isDirectory() && entry.name.startsWith('plugin-')) {
          results.push(path.join(scopedDir, entry.name));
        }
      }
    }
  } catch {
    // node_modules may not be readable
  }

  return results;
}

function scanLocalPlugins(config: ReturnType<typeof loadConfig>): string[] {
  const results: string[] = [];
  const root = process.cwd();
  const pluginsDir = path.join(root, '.shadow', 'plugins');

  if (!fs.existsSync(pluginsDir)) return results;

  try {
    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginFile = path.join(pluginsDir, entry.name, 'plugin.ts');
        const pluginJsFile = path.join(pluginsDir, entry.name, 'plugin.js');
        const pluginJsonFile = path.join(pluginsDir, entry.name, 'plugin.json');

        if (fs.existsSync(pluginFile) || fs.existsSync(pluginJsFile) || fs.existsSync(pluginJsonFile)) {
          results.push(path.join(pluginsDir, entry.name));
        }
      }
    }
  } catch {
    // ignore
  }

  return results;
}

async function loadPluginFromPath(dirPath: string): Promise<ShadowPlugin | null> {
  const configPath = path.join(dirPath, 'plugin.json');
  const tsPath = path.join(dirPath, 'plugin.ts');
  const jsPath = path.join(dirPath, 'plugin.js');
  const jsIndexPath = path.join(dirPath, 'index.js');

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const manifest = JSON.parse(raw) as ShadowPlugin;
      return validatePlugin(manifest, dirPath);
    } catch {
      return null;
    }
  }

  if (fs.existsSync(tsPath)) {
    return loadTypeScriptPlugin(tsPath);
  }

  if (fs.existsSync(jsPath)) {
    return loadJavaScriptPlugin(jsPath);
  }

  if (fs.existsSync(jsIndexPath)) {
    return loadJavaScriptPlugin(jsIndexPath);
  }

  return null;
}

async function loadTypeScriptPlugin(tsPath: string): Promise<ShadowPlugin | null> {
  try {
    const content = fs.readFileSync(tsPath, 'utf-8');
    const exportMatch = content.match(/export\s+default\s+(\w+)\s*[:;=]/);
    const defineMatch = content.match(/definePlugin\(\s*\{/);

    if (!exportMatch && !defineMatch) return null;

    const pluginName = path.basename(path.dirname(tsPath));
    return parsePluginFromSource(content, pluginName);
  } catch {
    return null;
  }
}

async function loadJavaScriptPlugin(jsPath: string): Promise<ShadowPlugin | null> {
  try {
    const resolved = require.resolve(jsPath);
    delete require.cache[resolved];
    const mod = require(jsPath);

    if (mod.default && typeof mod.default === 'object') {
      return validatePlugin(mod.default, jsPath);
    }

    if (mod.plugin && typeof mod.plugin === 'object') {
      return validatePlugin(mod.plugin, jsPath);
    }

    return null;
  } catch {
    return null;
  }
}

function parsePluginFromSource(content: string, fallbackName: string): ShadowPlugin | null {
  const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
  const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);

  if (!nameMatch || !versionMatch) return null;

  return {
    name: nameMatch[1] || fallbackName,
    version: versionMatch[1] || '0.0.0',
    description: descMatch ? descMatch[1] : '',
  };
}

function validatePlugin(plugin: unknown, sourcePath: string): ShadowPlugin | null {
  if (!plugin || typeof plugin !== 'object') return null;

  const p = plugin as Record<string, unknown>;

  if (typeof p.name !== 'string' || !p.name) {
    console.warn(chalk.yellow(`Invalid plugin at "${sourcePath}": missing "name"`));
    return null;
  }

  if (typeof p.version !== 'string' || !p.version) {
    console.warn(chalk.yellow(`Invalid plugin at "${sourcePath}": missing "version"`));
    return null;
  }

  const result: ShadowPlugin = {
    name: p.name as string,
    version: p.version as string,
    description: typeof p.description === 'string' ? p.description : '',
  };

  if (Array.isArray(p.commands)) result.commands = p.commands as ShadowPlugin['commands'];
  if (p.hooks && typeof p.hooks === 'object') result.hooks = p.hooks as ShadowPlugin['hooks'];
  if (Array.isArray(p.analyzers)) result.analyzers = p.analyzers as ShadowPlugin['analyzers'];
  if (Array.isArray(p.formatters)) result.formatters = p.formatters as ShadowPlugin['formatters'];

  return result;
}

function isPluginEnabled(plugin: ShadowPlugin, config: ReturnType<typeof loadConfig>): boolean {
  const pluginConfig = (config as Record<string, unknown>).plugins as
    | Record<string, { enabled?: boolean }>
    | undefined;

  if (!pluginConfig) return true;

  const cfg = pluginConfig[plugin.name];
  if (cfg === undefined) return true;

  return cfg.enabled !== false;
}

function findNodeModules(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 100; i++) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
