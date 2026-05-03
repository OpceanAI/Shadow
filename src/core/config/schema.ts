import { ShadowConfig } from '../../types';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
}

export function validateConfig(config: unknown): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  };

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    result.valid = false;
    result.errors.push({
      path: '',
      message: 'Config must be a non-null object',
    });
    return result;
  }

  const cfg = config as Record<string, unknown>;

  validateAIOptions(cfg, result);
  validateOutputStyle(cfg, result);
  validatePrivacy(cfg, result);
  validateTestGen(cfg, result);
  validateDeployChecks(cfg, result);
  validatePluginConfig(cfg, result);
  validateProfiles(cfg, result);
  validateAliases(cfg, result);

  if (cfg.cacheEnabled !== undefined && typeof cfg.cacheEnabled !== 'boolean') {
    result.errors.push({ path: 'cacheEnabled', message: 'Must be a boolean' });
  }

  if (cfg.cacheMaxSize !== undefined && typeof cfg.cacheMaxSize !== 'number') {
    result.errors.push({ path: 'cacheMaxSize', message: 'Must be a number (bytes)' });
  }

  if (cfg.parallelWorkers !== undefined && typeof cfg.parallelWorkers !== 'number') {
    result.errors.push({ path: 'parallelWorkers', message: 'Must be a number' });
  }

  if (cfg.batchSize !== undefined && typeof cfg.batchSize !== 'number') {
    result.errors.push({ path: 'batchSize', message: 'Must be a number' });
  }

  if (cfg.tracingDepth !== undefined && typeof cfg.tracingDepth !== 'number') {
    result.errors.push({ path: 'tracingDepth', message: 'Must be a number' });
  }

  if (cfg.maxMemoryMB !== undefined && typeof cfg.maxMemoryMB !== 'number') {
    result.errors.push({ path: 'maxMemoryMB', message: 'Must be a number' });
  }

  if (cfg.theme !== undefined && !['dark', 'light', 'minimal', 'neon'].includes(String(cfg.theme))) {
    result.errors.push({
      path: 'theme',
      message: 'Must be one of: dark, light, minimal, neon',
    });
  }

  if (cfg.emoji !== undefined && typeof cfg.emoji !== 'boolean') {
    result.errors.push({ path: 'emoji', message: 'Must be a boolean' });
  }

  if (cfg.verbose !== undefined && typeof cfg.verbose !== 'boolean') {
    result.errors.push({ path: 'verbose', message: 'Must be a boolean' });
  }

  if (cfg.ignoredPaths !== undefined) {
    if (!Array.isArray(cfg.ignoredPaths)) {
      result.errors.push({ path: 'ignoredPaths', message: 'Must be an array of strings' });
    } else if (!cfg.ignoredPaths.every((p: unknown) => typeof p === 'string')) {
      result.errors.push({ path: 'ignoredPaths', message: 'All values must be strings' });
    }
  }

  if (cfg.entryPoints !== undefined) {
    if (!Array.isArray(cfg.entryPoints)) {
      result.errors.push({ path: 'entryPoints', message: 'Must be an array of strings' });
    }
  }

  if (cfg.watchDebounceMs !== undefined && typeof cfg.watchDebounceMs !== 'number') {
    result.errors.push({ path: 'watchDebounceMs', message: 'Must be a number (milliseconds)' });
  }

  result.valid = result.errors.length === 0;
  return result;
}

function validateAIOptions(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.aiProvider !== undefined) {
    const validProviders = [
      'openai', 'claude', 'gemini', 'xai', 'deepseek', 'mistral',
      'groq', 'meta', 'cohere', 'together', 'perplexity', 'fireworks',
      'cerebras', 'replicate', 'local',
    ];
    if (!validProviders.includes(String(cfg.aiProvider))) {
      result.errors.push({
        path: 'aiProvider',
        message: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
      });
    }
  }
}

function validateOutputStyle(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.outputStyle !== undefined) {
    const valid = ['human', 'short', 'json', 'graph', 'patch', 'md'];
    if (!valid.includes(String(cfg.outputStyle))) {
      result.errors.push({
        path: 'outputStyle',
        message: `Must be one of: ${valid.join(', ')}`,
      });
    }
  }
}

function validatePrivacy(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.privacy !== undefined) {
    const privacy = cfg.privacy as Record<string, unknown>;
    if (typeof privacy !== 'object' || Array.isArray(privacy)) {
      result.errors.push({ path: 'privacy', message: 'Must be an object' });
      return;
    }
    if (privacy.maskSecrets !== undefined && typeof privacy.maskSecrets !== 'boolean') {
      result.errors.push({ path: 'privacy.maskSecrets', message: 'Must be a boolean' });
    }
    if (privacy.noNetwork !== undefined && typeof privacy.noNetwork !== 'boolean') {
      result.errors.push({ path: 'privacy.noNetwork', message: 'Must be a boolean' });
    }
    if (privacy.allowCloudAI !== undefined && typeof privacy.allowCloudAI !== 'boolean') {
      result.errors.push({ path: 'privacy.allowCloudAI', message: 'Must be a boolean' });
    }
  }
}

function validateTestGen(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.testGeneration !== undefined) {
    const tg = cfg.testGeneration as Record<string, unknown>;
    if (typeof tg !== 'object' || Array.isArray(tg)) {
      result.errors.push({ path: 'testGeneration', message: 'Must be an object' });
      return;
    }
    if (tg.fuzzCount !== undefined && typeof tg.fuzzCount !== 'number') {
      result.errors.push({ path: 'testGeneration.fuzzCount', message: 'Must be a number' });
    }
    if (tg.includeSecurity !== undefined && typeof tg.includeSecurity !== 'boolean') {
      result.errors.push({ path: 'testGeneration.includeSecurity', message: 'Must be a boolean' });
    }
    if (tg.excludePaths !== undefined) {
      if (!Array.isArray(tg.excludePaths)) {
        result.errors.push({ path: 'testGeneration.excludePaths', message: 'Must be an array' });
      }
    }
  }
}

function validateDeployChecks(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.deploymentChecks !== undefined) {
    const dc = cfg.deploymentChecks as Record<string, unknown>;
    if (typeof dc !== 'object' || Array.isArray(dc)) {
      result.errors.push({ path: 'deploymentChecks', message: 'Must be an object' });
      return;
    }
    if (dc.requiredEnvVars !== undefined && !Array.isArray(dc.requiredEnvVars)) {
      result.errors.push({ path: 'deploymentChecks.requiredEnvVars', message: 'Must be an array' });
    }
    if (dc.buildCommand !== undefined && typeof dc.buildCommand !== 'string') {
      result.errors.push({ path: 'deploymentChecks.buildCommand', message: 'Must be a string' });
    }
    if (dc.smokeTestCommand !== undefined && typeof dc.smokeTestCommand !== 'string') {
      result.errors.push({ path: 'deploymentChecks.smokeTestCommand', message: 'Must be a string' });
    }
  }
}

function validatePluginConfig(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.plugins !== undefined) {
    const plugins = cfg.plugins as Record<string, unknown>;
    if (typeof plugins !== 'object' || Array.isArray(plugins)) {
      result.errors.push({ path: 'plugins', message: 'Must be an object mapping plugin names to configs' });
      return;
    }
    for (const [pluginName, pluginCfg] of Object.entries(plugins)) {
      if (typeof pluginCfg !== 'object' || Array.isArray(pluginCfg) || pluginCfg === null) {
        result.errors.push({
          path: `plugins.${pluginName}`,
          message: 'Plugin config must be an object',
        });
        continue;
      }
      const p = pluginCfg as Record<string, unknown>;
      if (p.enabled !== undefined && typeof p.enabled !== 'boolean') {
        result.errors.push({
          path: `plugins.${pluginName}.enabled`,
          message: 'Must be a boolean',
        });
      }
    }
  }
}

function validateProfiles(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.activeProfile !== undefined && typeof cfg.activeProfile !== 'string') {
    result.errors.push({ path: 'activeProfile', message: 'Must be a string' });
  }

  if (cfg.profiles !== undefined) {
    const profiles = cfg.profiles as Record<string, unknown>;
    if (typeof profiles !== 'object' || Array.isArray(profiles)) {
      result.errors.push({ path: 'profiles', message: 'Must be an object' });
      return;
    }
    for (const [profileName, profileCfg] of Object.entries(profiles)) {
      if (typeof profileCfg !== 'object' || Array.isArray(profileCfg) || profileCfg === null) {
        result.errors.push({
          path: `profiles.${profileName}`,
          message: 'Profile config must be an object',
        });
      }
    }
  }
}

function validateAliases(cfg: Record<string, unknown>, result: ValidationResult): void {
  if (cfg.aliases !== undefined) {
    const aliases = cfg.aliases as Record<string, unknown>;
    if (typeof aliases !== 'object' || Array.isArray(aliases)) {
      result.errors.push({ path: 'aliases', message: 'Must be an object mapping alias to command' });
      return;
    }
    for (const [aliasName, aliasValue] of Object.entries(aliases)) {
      if (typeof aliasValue !== 'string') {
        result.errors.push({
          path: `aliases.${aliasName}`,
          message: 'Alias value must be a string (the target command)',
        });
      }
    }
  }
}
