import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, findFiles } from '../utils/fs';
import { detectLanguage } from '../lang/detector';
import chalk from 'chalk';

export interface KnowledgeEntity {
  id: string;
  type: 'file' | 'function' | 'class' | 'type' | 'interface' | 'module' | 'variable';
  name: string;
  file: string;
  line?: number;
  properties: Record<string, string>;
}

export interface KnowledgeRelation {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'inherits' | 'implements' | 'uses' | 'exports' | 'contains';
  file?: string;
}

export interface KnowledgeGraph {
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  stats: {
    entityCount: number;
    relationCount: number;
    filesAnalyzed: number;
  };
}

export interface JsonLdContext {
  '@context': Record<string, string>;
  '@graph': Array<Record<string, unknown>>;
}

export class KnowledgeGraphBuilder {
  private entities: KnowledgeEntity[] = [];
  private relations: KnowledgeRelation[] = [];
  private fileIndex: Map<string, number> = new Map();
  private entityCount = 0;

  build(projectPath?: string): KnowledgeGraph {
    this.entities = [];
    this.relations = [];
    this.fileIndex.clear();
    this.entityCount = 0;

    const config = loadConfig(projectPath);
    const analyzer = new Analyzer(config, projectPath);
    const project = analyzer.analyzeProject();

    for (const file of project.files) {
      this.addFileEntity(file.path, file.language);
      for (const fn of file.functions) {
        this.addFunctionEntity(fn, file.path);
      }
      for (const cls of file.classes) {
        this.addClassEntity(cls, file.path);
      }
      for (const imp of file.imports) {
        this.addImportRelation(file.path, imp.name, imp.type);
      }
      for (const exp of file.exports) {
        this.addExportRelation(file.path, exp);
      }
      for (const dep of file.dependencies) {
        this.addRelation(file.path, dep, 'uses');
      }
    }

    this.inferRelations();

    return {
      entities: this.entities,
      relations: this.relations,
      stats: {
        entityCount: this.entities.length,
        relationCount: this.relations.length,
        filesAnalyzed: project.files.length,
      },
    };
  }

  private addFileEntity(path: string, language: string): void {
    const id = this.nextId('file', path);
    this.entities.push({
      id,
      type: 'file',
      name: path,
      file: path,
      properties: { language },
    });
    this.fileIndex.set(path, this.entities.length - 1);
  }

  private addFunctionEntity(name: string, file: string): void {
    const id = this.nextId('fn', `${file}#${name}`);
    this.entities.push({
      id,
      type: 'function',
      name,
      file,
      properties: {},
    });
    this.addRelation(file, id, 'contains');
  }

  private addClassEntity(name: string, file: string): void {
    const id = this.nextId('cls', `${file}#${name}`);
    this.entities.push({
      id,
      type: 'class',
      name,
      file,
      properties: {},
    });
    this.addRelation(file, id, 'contains');
  }

  private addImportRelation(file: string, target: string, type: string): void {
    const targetId = this.findEntityId(target) || this.createExternalEntity(target);
    this.addRelation(file, targetId, type === 'external' ? 'imports' : 'uses');
  }

  private addExportRelation(file: string, name: string): void {
    const entityId = this.findEntityByName(name);
    if (entityId) {
      this.addRelation(file, entityId, 'exports');
    }
  }

  private createExternalEntity(name: string): string {
    const id = this.nextId('ext', name);
    this.entities.push({
      id,
      type: 'module',
      name,
      file: '',
      properties: { external: 'true' },
    });
    return id;
  }

  private findEntityId(name: string): string | undefined {
    return this.entities.find((e) => e.name === name)?.id;
  }

  private findEntityByName(name: string): string | undefined {
    return this.entities.find((e) => e.name === name && e.type !== 'file')?.id;
  }

  private addRelation(from: string, to: string, type: KnowledgeRelation['type']): void {
    const fromId = this.findEntityId(from) || from;
    const toId = this.findEntityId(to) || to;
    const exists = this.relations.some(
      (r) => r.from === fromId && r.to === toId && r.type === type,
    );
    if (!exists && fromId !== toId) {
      this.relations.push({ from: fromId, to: toId, type });
    }
  }

  private inferRelations(): void {
    const files = new Map<string, string>();
    const allFiles = findFiles(process.cwd(), ['*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs']);

    for (const fp of allFiles) {
      try {
        const content = readFile(fp);
        const rel = this.resolveImportPatterns(content, fp);
        for (const { target } of rel) {
          this.addRelation(fp, target, 'uses');
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  private resolveImportPatterns(content: string, filePath: string): Array<{ target: string }> {
    const results: Array<{ target: string }> = [];

    const esImport = /import\s+(?:[\w{},*\s]+from\s+)?['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    while ((match = esImport.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        const resolved = this.resolveRelative(filePath, match[1]);
        if (resolved) results.push({ target: resolved });
      }
    }

    const requireMatch = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireMatch.exec(content)) !== null) {
      if (match[1].startsWith('.')) {
        const resolved = this.resolveRelative(filePath, match[1]);
        if (resolved) results.push({ target: resolved });
      }
    }

    return results;
  }

  private resolveRelative(fromPath: string, importPath: string): string | undefined {
    const dir = fromPath.substring(0, fromPath.lastIndexOf('/') + 1);
    const baseExts = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '/index.ts', '/index.js'];
    for (const ext of baseExts) {
      const resolved = this.normalizePath(dir + importPath + ext);
      if (this.fileIndex.has(resolved)) {
        return resolved;
      }
    }
    return undefined;
  }

  private normalizePath(p: string): string {
    const parts = p.split('/');
    const result: string[] = [];
    for (const part of parts) {
      if (part === '..') result.pop();
      else if (part !== '.' && part !== '') result.push(part);
    }
    return result.join('/');
  }

  private nextId(prefix: string, name: string): string {
    return `${prefix}_${this.entityCount++}_${name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40)}`;
  }

  toJsonLd(): JsonLdContext {
    const context: Record<string, string> = {
      '@vocab': 'https://schema.org/',
      shadow: 'https://shadow.dev/ontology#',
      file: 'shadow:file',
      function: 'shadow:function',
      class: 'shadow:class',
      imports: 'shadow:imports',
      calls: 'shadow:calls',
      inherits: 'shadow:inherits',
      implements: 'shadow:implements',
      uses: 'shadow:uses',
      contains: 'shadow:contains',
    };

    const graph: Array<Record<string, unknown>> = [];

    for (const entity of this.entities) {
      graph.push({
        '@id': entity.id,
        '@type': entity.type === 'file' ? 'SoftwareSourceCode' : entity.type,
        name: entity.name,
        ...(entity.file ? { 'shadow:file': entity.file } : {}),
        ...entity.properties,
      });
    }

    for (const rel of this.relations) {
      graph.push({
        '@id': `rel_${rel.from}_${rel.to}_${rel.type}`,
        '@type': 'Relationship',
        'shadow:source': rel.from,
        'shadow:target': rel.to,
        'shadow:relationType': rel.type,
      });
    }

    return { '@context': context, '@graph': graph };
  }

  toNeo4jCypher(): string {
    const lines: string[] = [];

    for (const e of this.entities) {
      const props = [{ name: e.name, file: e.file }, ...Object.entries(e.properties).map(([k, v]) => ({ [k]: v }))];
      const propStr = props.map((p) => {
        const [k, v] = Object.entries(p)[0];
        return `${k}: "${v.replace(/"/g, '\\"')}"`;
      }).join(', ');
      lines.push(`CREATE (:${e.type} {${propStr}});`);
    }

    for (const r of this.relations) {
      const fromType = this.entities.find((e) => e.id === r.from)?.type || 'Unknown';
      const toType = this.entities.find((e) => e.id === r.to)?.type || 'Unknown';
      lines.push(`MATCH (a:${fromType} {name: "${r.from}"}), (b:${toType} {name: "${r.to}"})`);
      lines.push(`CREATE (a)-[:${r.type.toUpperCase()}]->(b);`);
    }

    return lines.join('\n');
  }
}

export function buildKnowledgeGraph(): KnowledgeGraph {
  return new KnowledgeGraphBuilder().build();
}

export function printKnowledgeGraph(): void {
  const builder = new KnowledgeGraphBuilder();
  const kg = builder.build();

  console.log(chalk.bold.blue('\n[shadow knowledge-graph]\n'));
  console.log(chalk.white(`Entities: ${kg.stats.entityCount}`));
  console.log(chalk.white(`Relations: ${kg.stats.relationCount}`));
  console.log(chalk.white(`Files analyzed: ${kg.stats.filesAnalyzed}`));
  console.log();

  const byType: Record<string, number> = {};
  for (const e of kg.entities) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }
  console.log(chalk.bold('Entities by type:'));
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${chalk.cyan(type)}: ${count}`);
  }

  const relByType: Record<string, number> = {};
  for (const r of kg.relations) {
    relByType[r.type] = (relByType[r.type] || 0) + 1;
  }
  console.log(chalk.bold('\nRelations by type:'));
  for (const [type, count] of Object.entries(relByType).sort()) {
    console.log(`  ${chalk.magenta(type)}: ${count}`);
  }
  console.log();
}
