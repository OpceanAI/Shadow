import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ShadowConfig } from '../../types';
import { fileExists, readFile } from '../../utils/fs';

export function getActiveProfile(config: ShadowConfig): string | null {
  const cfg = config as Record<string, unknown>;
  const active = cfg.activeProfile as string | undefined;
  return active || process.env.SHADOW_PROFILE || null;
}

export function loadProfile(root: string, profileName: string): ShadowConfig | null {
  const profilePaths = [
    path.join(root, '.shadow', 'profiles', `${profileName}.json`),
    path.join(root, '.shadow', 'profiles', `${profileName}.yml`),
    path.join(root, '.shadow', 'profiles', `${profileName}.yaml`),
    path.join(root, '.shadowrc.profiles.json'),
    path.join(root, '.shadowrc.profiles.yml'),
  ];

  for (const profilePath of profilePaths) {
    if (fileExists(profilePath)) {
      try {
        const raw = readFile(profilePath);
        const ext = path.extname(profilePath).toLowerCase();

        let parsed: Record<string, unknown>;
        if (ext === '.yml' || ext === '.yaml') {
          parsed = yaml.load(raw) as Record<string, unknown>;
        } else {
          parsed = JSON.parse(raw);
        }

        if (path.basename(profilePath).startsWith('.shadowrc.profiles')) {
          const profiles = parsed as Record<string, Partial<ShadowConfig>>;
          const profile = profiles[profileName];
          if (profile) {
            return profile as ShadowConfig;
          }
        } else {
          return parsed as unknown as ShadowConfig;
        }
      } catch {
        // ignore parse errors
      }
    }
  }

  const config = (awaitLoadMainConfig(root)) as Record<string, unknown>;
  const profiles = config.profiles as Record<string, Partial<ShadowConfig>> | undefined;
  if (profiles && profiles[profileName]) {
    return profiles[profileName] as ShadowConfig;
  }

  return null;
}

function awaitLoadMainConfig(root: string): ShadowConfig {
  const configPaths = [
    path.join(root, '.shadow', 'config.json'),
    path.join(root, '.shadowrc'),
    path.join(root, '.shadowrc.json'),
    path.join(root, '.shadowrc.yml'),
    path.join(root, '.shadowrc.yaml'),
  ];

  for (const configPath of configPaths) {
    if (fileExists(configPath)) {
      try {
        const raw = readFile(configPath);
        const ext = path.extname(configPath).toLowerCase();
        if (ext === '.yml' || ext === '.yaml') {
          return (yaml.load(raw) as unknown) as ShadowConfig;
        }
        return JSON.parse(raw) as ShadowConfig;
      } catch {
        // ignore
      }
    }
  }

  return {} as ShadowConfig;
}

export function listProfiles(root: string): string[] {
  const profiles: Set<string> = new Set();
  const profilesDir = path.join(root, '.shadow', 'profiles');

  if (fs.existsSync(profilesDir)) {
    try {
      const entries = fs.readdirSync(profilesDir);
      for (const entry of entries) {
        const match = entry.match(/^(.+)\.(json|yml|yaml)$/);
        if (match) {
          profiles.add(match[1]);
        }
      }
    } catch {
      // ignore
    }
  }

  for (const file of ['.shadowrc.profiles.json', '.shadowrc.profiles.yml']) {
    const profilesFile = path.join(root, file);
    if (fileExists(profilesFile)) {
      try {
        const raw = readFile(profilesFile);
        let parsed: Record<string, unknown>;
        if (file.endsWith('.yml')) {
          parsed = yaml.load(raw) as Record<string, unknown>;
        } else {
          parsed = JSON.parse(raw);
        }
        for (const key of Object.keys(parsed)) {
          profiles.add(key);
        }
      } catch {
        // ignore
      }
    }
  }

  const config = awaitLoadMainConfig(root) as Record<string, unknown>;
  const inlineProfiles = config.profiles as Record<string, unknown> | undefined;
  if (inlineProfiles) {
    for (const key of Object.keys(inlineProfiles)) {
      profiles.add(key);
    }
  }

  return Array.from(profiles).sort();
}
