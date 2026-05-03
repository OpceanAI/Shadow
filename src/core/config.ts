import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { ShadowConfig } from '../types';
import { readFile, fileExists, getProjectRoot } from '../utils/fs';
import { loadProfile, getActiveProfile } from './config/profile';
import { loadAliases } from './config/alias';

export function loadConfig(projectPath?: string): ShadowConfig {
  const root = projectPath ? getProjectRoot(projectPath) : process.cwd();

  const configPaths = getConfigPaths(root);

  let config = getDefaultConfig();

  const globalConfig = loadGlobalConfig();
  if (globalConfig) {
    config = deepMerge(config as unknown as Record<string, unknown>, globalConfig as unknown as Record<string, unknown>) as unknown as ShadowConfig;
  }

  for (const configPath of configPaths) {
    if (fileExists(configPath)) {
      try {
        const loaded = parseConfigFile(configPath);
        config = deepMerge(config as unknown as Record<string, unknown>, loaded as unknown as Record<string, unknown>) as unknown as ShadowConfig;
        break;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('Warning: Failed to parse config file:', message);
      }
    }
  }

  const profile = getActiveProfile(config);
  if (profile) {
    const profileConfig = loadProfile(root, profile);
    if (profileConfig) {
      config = deepMerge(config as unknown as Record<string, unknown>, profileConfig as unknown as Record<string, unknown>) as unknown as ShadowConfig;
    }
  }

  return config;
}

function getConfigPaths(root: string): string[] {
  return [
    path.join(root, '.shadow', 'config.json'),
    path.join(root, '.shadowrc'),
    path.join(root, '.shadowrc.json'),
    path.join(root, '.shadowrc.yml'),
    path.join(root, '.shadowrc.yaml'),
  ];
}

function parseConfigFile(filePath: string): ShadowConfig {
  const raw = readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.yml' || ext === '.yaml') {
    const parsed = yaml.load(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid YAML config: not an object');
    }
    return parsed as unknown as ShadowConfig;
  }

  return JSON.parse(raw) as ShadowConfig;
}

function loadGlobalConfig(): ShadowConfig | null {
  const globalConfigPaths = [
    path.join(process.env.HOME || '/root', '.shadowrc'),
    path.join(process.env.HOME || '/root', '.shadowrc.json'),
    path.join(process.env.HOME || '/root', '.config', 'shadow', 'config.json'),
  ];

  for (const configPath of globalConfigPaths) {
    if (fileExists(configPath)) {
      try {
        return parseConfigFile(configPath);
      } catch {
        // ignore invalid global config
      }
    }
  }

  return null;
}

export function getDefaultConfig(): ShadowConfig {
  return {
    aiProvider: 'local',
    outputStyle: 'human',
    cacheEnabled: true,
    privacy: {
      maskSecrets: true,
      noNetwork: false,
      allowCloudAI: false,
    },
    tracingDepth: 10,
    testGeneration: {
      fuzzCount: 100,
      includeSecurity: true,
      excludePaths: [],
    },
    deploymentChecks: {
      requiredEnvVars: [],
      buildCommand: '',
      smokeTestCommand: '',
    },
    ignoredPaths: ['.git', 'node_modules', '__pycache__', '.venv'],
    entryPoints: [],
  };
}

export function saveConfig(config: ShadowConfig, projectPath?: string): void {
  const root = projectPath || process.cwd();
  const configDir = path.join(root, '.shadow');
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify(config, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.warn(chalk.yellow(`Warning: could not write config to ${configDir}: ${(err as Error).message}`));
  }
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = override[key];

    if (
      baseVal &&
      overrideVal &&
      typeof baseVal === 'object' &&
      typeof overrideVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(overrideVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result;
}

export function loadAliasesForCommands(config?: ShadowConfig): Record<string, string> {
  if (!config) {
    config = loadConfig();
  }

  const explicitAliases = (config as Record<string, unknown>).aliases as
    | Record<string, string>
    | undefined;

  return loadAliases(explicitAliases);
}
