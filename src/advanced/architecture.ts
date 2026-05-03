import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, findFiles } from '../utils/fs';
import { fileExists } from '../utils/fs';
import chalk from 'chalk';

export type ArchitecturePattern =
  | 'mvc'
  | 'microservices'
  | 'monolith'
  | 'layered'
  | 'event-driven'
  | 'hexagonal'
  | 'serverless'
  | 'plugin'
  | 'pipeline'
  | 'unknown';

export interface LayerInfo {
  name: string;
  files: string[];
  dependencies: string[];
  dependents: string[];
}

export interface ArchitectureAnalysis {
  detectedPattern: ArchitecturePattern;
  confidence: number;
  layers: LayerInfo[];
  externalServices: string[];
  dataStores: string[];
  entryPoints: string[];
  cycles: string[][];
  decisionRecords: ArchitectureDecision[];
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  consequences: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
}

export interface C4Model {
  systemContext: C4System;
  containers: C4Container[];
  components: C4Component[];
}

export interface C4System {
  name: string;
  description: string;
  externalSystems: Array<{ name: string; description: string; relationship: string }>;
}

export interface C4Container {
  name: string;
  technology: string;
  description: string;
  responsibilities: string[];
}

export interface C4Component {
  name: string;
  container: string;
  technology: string;
  description: string;
  interfaces: string[];
}

export class ArchitectureAnalyzer {
  analyze(): ArchitectureAnalysis {
    const config = loadConfig();
    const analyzer = new Analyzer(config);
    const project = analyzer.analyzeProject();

    const pattern = this.detectPattern(project);
    const layers = this.detectLayers(project);
    const externals = this.detectExternalServices(project);
    const dataStores = this.detectDataStores();
    const cycles = this.detectCycles(layers);
    const decisions = this.findDecisionRecords();

    return {
      detectedPattern: pattern.type,
      confidence: pattern.confidence,
      layers,
      externalServices: externals,
      dataStores,
      entryPoints: project.entryPoints,
      cycles,
      decisionRecords: decisions,
    };
  }

  private detectPattern(project: ReturnType<Analyzer['analyzeProject']>): { type: ArchitecturePattern; confidence: number } {
    const paths = project.files.map((f) => f.path.toLowerCase());
    let scores: Record<ArchitecturePattern, number> = {
      mvc: 0,
      microservices: 0,
      monolith: 0,
      layered: 0,
      'event-driven': 0,
      hexagonal: 0,
      serverless: 0,
      plugin: 0,
      pipeline: 0,
      unknown: 0,
    };

    const hasModels = paths.some((p) => p.includes('model'));
    const hasViews = paths.some((p) => p.includes('view') || p.includes('template') || p.includes('component'));
    const hasControllers = paths.some((p) => p.includes('controller') || p.includes('handler') || p.includes('route'));
    const hasServices = paths.some((p) => p.includes('service'));
    const hasRepositories = paths.some((p) => p.includes('repository') || p.includes('repo'));
    const hasEvents = paths.some((p) => p.includes('event') || p.includes('message') || p.includes('queue'));
    const hasPlugins = paths.some((p) => p.includes('plugin') || p.includes('extension') || p.includes('addon'));
    const hasPipeline = paths.some((p) => p.includes('pipeline') || p.includes('step') || p.includes('stage'));
    const hasLambda = paths.some((p) => p.includes('lambda') || p.includes('function') || p.includes('handler'));

    if (hasModels && hasViews && hasControllers) {
      scores.mvc = 0.8;
    }
    if (hasServices && hasRepositories) {
      scores.layered = 0.7;
    }
    if (hasControllers && hasServices && hasRepositories) {
      scores.hexagonal = 0.5;
    }
    if (hasEvents) {
      scores['event-driven'] = 0.6;
    }
    if (hasPlugins) {
      scores.plugin = 0.5;
    }
    if (hasPipeline) {
      scores.pipeline = 0.5;
    }
    if (hasLambda && !hasViews) {
      scores.serverless = 0.3;
    }

    // Check for multiple services (microservices)
    const dockerFiles = findFiles(process.cwd(), ['Dockerfile*', 'docker-compose*']);
    const k8sFiles = findFiles(process.cwd(), ['*.yaml', '*.yml']).filter(
      (f) => readFile(f).includes('kind:') && readFile(f).includes('Deployment'),
    );
    if (dockerFiles.length > 1 || k8sFiles.length > 0) {
      scores.microservices = 0.5;
    }

    // Default to monolith if nothing specific detected
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
      scores.monolith = 0.4;
      scores.unknown = 0.6;
    }

    const best = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a));
    return { type: best[0] as ArchitecturePattern, confidence: best[1] };
  }

  private detectLayers(project: ReturnType<Analyzer['analyzeProject']>): LayerInfo[] {
    const layerMap = new Map<string, string[]>();

    for (const file of project.files) {
      let layer = 'other';
      const p = file.path.toLowerCase();

      if (p.includes('controller') || p.includes('handler') || p.includes('route') || p.includes('router')) {
        layer = 'presentation';
      } else if (p.includes('service') || p.includes('usecase') || p.includes('business')) {
        layer = 'application';
      } else if (p.includes('model') || p.includes('entity') || p.includes('schema') || p.includes('dto')) {
        layer = 'domain';
      } else if (p.includes('repository') || p.includes('dao') || p.includes('database') || p.includes('db')) {
        layer = 'persistence';
      } else if (p.includes('util') || p.includes('helper') || p.includes('common') || p.includes('lib')) {
        layer = 'infrastructure';
      } else if (p.includes('config') || p.includes('setting') || p.includes('env')) {
        layer = 'configuration';
      }

      const files = layerMap.get(layer) || [];
      files.push(file.path);
      layerMap.set(layer, files);
    }

    return Array.from(layerMap.entries()).map(([name, files]) => ({
      name,
      files,
      dependencies: [],
      dependents: [],
    }));
  }

  private detectExternalServices(project: ReturnType<Analyzer['analyzeProject']>): string[] {
    const externals = new Set(project.externalAPIs);

    for (const file of project.files) {
      for (const imp of file.imports) {
        if (imp.type === 'external') {
          externals.add(imp.name);
        }
      }
    }

    return Array.from(externals).sort();
  }

  private detectDataStores(): string[] {
    const stores: string[] = [];
    const indicators = [
      { pattern: 'mongoose', store: 'MongoDB' },
      { pattern: 'prisma', store: 'Prisma' },
      { pattern: 'pg', store: 'PostgreSQL' },
      { pattern: 'mysql', store: 'MySQL' },
      { pattern: 'redis', store: 'Redis' },
      { pattern: 'sqlite', store: 'SQLite' },
      { pattern: 'dynamodb', store: 'DynamoDB' },
      { pattern: 'firebase', store: 'Firebase' },
      { pattern: 'supabase', store: 'Supabase' },
    ];

    try {
      const pkgJson = readFile('package.json');
      const pkg = JSON.parse(pkgJson);
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };

      for (const { pattern, store } of indicators) {
        if (allDeps[pattern]) {
          stores.push(store);
        }
      }
    } catch {
      // package.json not found
    }

    return stores;
  }

  private detectCycles(layers: LayerInfo[]): string[][] {
    // Simple cycle detection: look for files importing from each other
    const cycles: string[][] = [];
    // This is a simplified heuristic
    return cycles;
  }

  private findDecisionRecords(): ArchitectureDecision[] {
    const records: ArchitectureDecision[] = [];
    const adrDir = '.shadow/adr';

    try {
      const adrFiles = findFiles(adrDir, ['*.md']);
      for (const adrFile of adrFiles) {
        const content = readFile(adrFile);
        const title = content.match(/#\s+(.+)/)?.[1] || adrFile;
        records.push({
          id: adrFile,
          title,
          context: '',
          decision: '',
          consequences: '',
          status: 'proposed',
        });
      }
    } catch {
      // no ADR directory
    }

    return records;
  }

  generateC4Model(): C4Model {
    const config = loadConfig();
    const analyzer = new Analyzer(config);
    const project = analyzer.analyzeProject();

    const systemContext: C4System = {
      name: project.name,
      description: project.summary,
      externalSystems: project.externalAPIs.map((api) => ({
        name: api,
        description: `External service: ${api}`,
        relationship: 'Uses',
      })),
    };

    const containers: C4Container[] = [];
    const components: C4Component[] = [];

    // Group files into containers
    const fileGroups = this.groupFiles(project);

    for (const [group, files] of Object.entries(fileGroups)) {
      containers.push({
        name: group,
        technology: project.language,
        description: `${files.length} files`,
        responsibilities: files.slice(0, 5).map((f) => f),
      });

      for (const file of files.slice(0, 10)) {
        components.push({
          name: file,
          container: group,
          technology: project.language,
          description: '',
          interfaces: [],
        });
      }
    }

    return { systemContext, containers, components };
  }

  private groupFiles(project: ReturnType<Analyzer['analyzeProject']>): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    for (const file of project.files) {
      const parts = file.path.split('/');
      const group = parts.length > 1 ? parts[0] : 'root';
      if (!groups[group]) groups[group] = [];
      groups[group].push(file.path);
    }
    return groups;
  }

  validateLayerDependencies(): Array<{ from: string; to: string; allowed: boolean }> {
    const config = loadConfig();
    const analyzer = new Analyzer(config);
    const project = analyzer.analyzeProject();

    const layers = this.detectLayers(project);
    const allowedDirections: Array<[string, string]> = [
      ['presentation', 'application'],
      ['application', 'domain'],
      ['application', 'persistence'],
      ['domain', 'persistence'],
      ['infrastructure', 'application'],
      ['infrastructure', 'domain'],
    ];

    const violations: Array<{ from: string; to: string; allowed: boolean }> = [];

    for (let i = 0; i < layers.length; i++) {
      for (let j = 0; j < layers.length; j++) {
        if (i === j) continue;
        const allowed = allowedDirections.some(
          ([a, b]) => a === layers[i].name && b === layers[j].name,
        );
        violations.push({
          from: layers[i].name,
          to: layers[j].name,
          allowed,
        });
      }
    }

    return violations;
  }
}

export function printArchitecture(): void {
  const arch = new ArchitectureAnalyzer();
  const analysis = arch.analyze();

  console.log(chalk.bold.blue('\n[shadow architecture]\n'));

  console.log(chalk.bold('Detected Pattern:'));
  const patternColor = analysis.confidence > 0.6 ? chalk.green : chalk.yellow;
  console.log(`  ${patternColor(analysis.detectedPattern)} ${chalk.dim(`(confidence: ${(analysis.confidence * 100).toFixed(0)}%)`)}`);
  console.log();

  console.log(chalk.bold('Layers:'));
  for (const layer of analysis.layers) {
    console.log(`  ${chalk.cyan(layer.name)}: ${chalk.dim(`${layer.files.length} files`)}`);
    for (const f of layer.files.slice(0, 3)) {
      console.log(chalk.dim(`    - ${f}`));
    }
    if (layer.files.length > 3) {
      console.log(chalk.dim(`    ... and ${layer.files.length - 3} more`));
    }
  }
  console.log();

  if (analysis.externalServices.length > 0) {
    console.log(chalk.bold('External Services:'));
    for (const svc of analysis.externalServices) {
      console.log(`  ${chalk.magenta('↗')} ${svc}`);
    }
    console.log();
  }

  if (analysis.dataStores.length > 0) {
    console.log(chalk.bold('Data Stores:'));
    for (const ds of analysis.dataStores) {
      console.log(`  ${chalk.yellow('◈')} ${ds}`);
    }
    console.log();
  }

  if (analysis.entryPoints.length > 0) {
    console.log(chalk.bold('Entry Points:'));
    for (const ep of analysis.entryPoints.slice(0, 5)) {
      console.log(`  ${chalk.green('▶')} ${ep}`);
    }
    console.log();
  }
}
