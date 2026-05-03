import { FileInfo, ProjectInfo, ShadowConfig } from '../types';
import { AnalysisCache, computeFileHash } from './cache';
import { Analyzer } from './analyzer';
import { findFiles, readFile } from '../utils/fs';
import { GraphBuilder } from './graph';
import { getEnvVarsFromCode } from '../utils/env';
import { detectLanguage } from '../lang/detector';

export interface IncrementalDiff {
  changed: string[];
  added: string[];
  removed: string[];
  unchanged: string[];
}

export class IncrementalAnalyzer {
  private cache: AnalysisCache;
  private analyzer: Analyzer;
  private knownFiles: Map<string, string>;

  constructor(private config: ShadowConfig) {
    this.cache = new AnalysisCache(config.cacheDir, config.cacheMaxSize || 500);
    this.analyzer = new Analyzer(config);
    this.knownFiles = new Map();
  }

  diffFiles(currentFiles: string[]): IncrementalDiff {
    const currentSet = new Set(currentFiles);
    const knownSet = new Set(this.knownFiles.keys());

    const changed: string[] = [];
    const added: string[] = [];
    const unchanged: string[] = [];

    for (const file of currentFiles) {
      if (!knownSet.has(file)) {
        added.push(file);
      } else {
        const oldHash = this.knownFiles.get(file);
        const content = readFile(file);
        const newHash = computeFileHash(content);

        if (oldHash !== newHash) {
          changed.push(file);
        } else {
          unchanged.push(file);
        }
      }
    }

    const removed: string[] = [];
    for (const known of knownSet) {
      if (!currentSet.has(known)) {
        removed.push(known);
      }
    }

    return { changed, added, removed, unchanged };
  }

  analyzeIncremental(baseDir?: string): { project: ProjectInfo; diff: IncrementalDiff } {
    const root = baseDir || process.cwd();
    const patterns = [
      '*.py', '*.ts', '*.tsx', '*.js', '*.jsx', '*.rs', '*.go',
      '*.sh', '*.bash', '*.zsh', '*.java', '*.kt', '*.swift',
      '*.rb', '*.php', '*.scala', '*.ex', '*.exs', '*.hs',
      '*.cpp', '*.c', '*.hpp', '*.h', '*.sql', '*.tf',
    ];

    const allFiles = findFiles(root, patterns);
    const diff = this.diffFiles(allFiles);

    const fileInfos: FileInfo[] = [];

    for (const file of diff.unchanged) {
      const content = readFile(file);
      const cached = this.cache.get(file, content);
      if (cached) {
        fileInfos.push(cached);
      } else {
        const info = this.analyzer.analyzeFile(file, root);
        this.cache.set(file, content, info);
        fileInfos.push(info);
      }
    }

    for (const file of [...diff.changed, ...diff.added]) {
      const content = readFile(file);
      const info = this.analyzer.analyzeFile(file, root);
      this.cache.set(file, content, info);
      fileInfos.push(info);
    }

    const fileHashMap = new Map<string, string>();
    for (const file of allFiles) {
      try {
        if (!diff.removed.includes(file)) {
          fileHashMap.set(file, computeFileHash(readFile(file)));
        }
      } catch {
        // File may not exist anymore
      }
    }
    this.knownFiles = fileHashMap;

    const builder = new GraphBuilder();
    const graph = builder.buildFromFiles(fileInfos);

    const language = detectLanguage(root);
    const allEnvVars = new Set<string>();
    const allExternalAPIs = new Set<string>();
    const entryPoints: string[] = [];

    for (const fi of fileInfos) {
      fi.envVars.forEach((e) => allEnvVars.add(e));
      fi.externalCalls.forEach((c) => allExternalAPIs.add(c));
      if (fi.exports.length > 0 || fi.functions.some((f) => f === 'main')) {
        entryPoints.push(fi.path);
      }
    }

    const project: ProjectInfo = {
      name: root.split('/').pop() || 'unknown',
      rootPath: root,
      language,
      summary: `${language} project with ${fileInfos.length} files (${diff.changed.length} changed, ${diff.added.length} new)`,
      files: fileInfos,
      entryPoints,
      envVars: Array.from(allEnvVars),
      externalAPIs: Array.from(allExternalAPIs),
      totalFiles: fileInfos.length,
      graph,
    };

    return { project, diff };
  }

  getStats() {
    return this.cache.stats();
  }

  saveCache(): void {
    this.cache.save();
  }
}
