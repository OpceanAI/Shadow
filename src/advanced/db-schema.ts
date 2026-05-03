import { readFile, findFiles, fileExists } from '../utils/fs';
import chalk from 'chalk';

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  indexes: IndexSchema[];
  foreignKeys: ForeignKeySchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface SchemaChange {
  type: 'added' | 'removed' | 'modified';
  table: string;
  column?: string;
  oldType?: string;
  newType?: string;
}

export interface SchemaDiff {
  changes: SchemaChange[];
  addedTables: string[];
  removedTables: string[];
  modifiedTables: string[];
}

export interface DBSchemaReport {
  tables: TableSchema[];
  modelFiles: string[];
  migrationHistory: string[];
}

export class DBSchemaAnalyzer {
  analyze(projectPath?: string): DBSchemaReport {
    const root = projectPath || process.cwd();
    const tables: TableSchema[] = [];
    const modelFiles: string[] = [];

    // Find Prisma schemas
    const prismaPath = `${root}/prisma/schema.prisma`;
    try {
      if (fileExists(prismaPath)) {
        const content = readFile(prismaPath);
        tables.push(...this.parsePrismaSchema(content));
        modelFiles.push(prismaPath);
      }
    } catch {
      // skip
    }

    // Find TypeORM entities
    const tsFiles = findFiles(root, ['*.ts', '*.tsx']);
    for (const file of tsFiles) {
      try {
        const content = readFile(file);
        if (content.includes('@Entity') || content.includes('@Table')) {
          modelFiles.push(file);
          tables.push(...this.parseTypeORMEntities(content, file));
        }
      } catch {
        // skip
      }
    }

    // Find SQL migration files
    const migrations = this.findMigrationFiles(root);

    return {
      tables,
      modelFiles,
      migrationHistory: migrations,
    };
  }

  private parsePrismaSchema(content: string): TableSchema[] {
    const tables: TableSchema[] = [];
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(content)) !== null) {
      const tableName = match[1];
      const body = match[2];
      const columns: ColumnSchema[] = [];
      const indexes: IndexSchema[] = [];
      const foreignKeys: ForeignKeySchema[] = [];

      const lines = body.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('//')) continue;

        if (trimmed.startsWith('@@')) {
          // Attribute
          const idxMatch = trimmed.match(/@@index\s*\(\s*\[([^\]]+)\]\s*\)/);
          if (idxMatch) {
            indexes.push({
              name: `idx_${tableName}`,
              columns: idxMatch[1].split(',').map((c) => c.trim()),
              unique: false,
            });
          }
          const uniqueMatch = trimmed.match(/@@unique\s*\(\s*\[([^\]]+)\]\s*\)/);
          if (uniqueMatch) {
            indexes.push({
              name: `uq_${tableName}`,
              columns: uniqueMatch[1].split(',').map((c) => c.trim()),
              unique: true,
            });
          }
          continue;
        }

        const colMatch = trimmed.match(/(\w+)\s+(\w+(?:\[\])?)\s*(@\w+(?:\([^)]*\))?)*/);
        if (colMatch) {
          const colName = colMatch[1];
          const colType = colMatch[2];
          const attributes = trimmed;

          columns.push({
            name: colName,
            type: colType,
            nullable: !attributes.includes('@id') && !attributes.includes('@unique') && attributes.includes('?'),
            primaryKey: attributes.includes('@id'),
            defaultValue: attributes.match(/@default\s*\(\s*([^)]+)\s*\)/)?.[1],
          });
        }

        // Relations
        const relMatch = trimmed.match(/(\w+)\s+(\w+)\s*@relation\s*\(\s*fields\s*:\s*\[(\w+)\]\s*,\s*references\s*:\s*\[(\w+)\]\s*\)/);
        if (relMatch) {
          foreignKeys.push({
            column: relMatch[3],
            referencedTable: relMatch[2],
            referencedColumn: relMatch[4],
          });
        }
      }

      tables.push({ name: tableName, columns, indexes, foreignKeys });
    }

    return tables;
  }

  private parseTypeORMEntities(content: string, file: string): TableSchema[] {
    const tables: TableSchema[] = [];
    const columns: ColumnSchema[] = [];
    const indexes: IndexSchema[] = [];
    const foreignKeys: ForeignKeySchema[] = [];

    const entityMatch = content.match(/@Entity\s*\(\s*{\s*name\s*:\s*['"](\w+)['"]/);
    const tableName = entityMatch ? entityMatch[1] : file.split('/').pop()?.replace('.ts', '').replace('.entity', '') || 'unknown';

    const lines = content.split('\n');
    for (const line of lines) {
      const colMatch = line.match(/@Column\s*\(\s*\{?\s*(?:.*?)\s*\}?\s*\)\s*\n?\s*(\w+)\s*:\s*(\w+)/);
      if (colMatch) {
        columns.push({
          name: colMatch[1],
          type: colMatch[2],
          nullable: !line.includes('nullable: false'),
          primaryKey: line.includes('PrimaryGeneratedColumn') || line.includes('PrimaryColumn'),
        });
      }

      const pkMatch = line.match(/@Primary(?:Generated)?Column\s*\(\s*\)\s*\n?\s*(\w+)\s*:\s*(\w+)/);
      if (pkMatch) {
        columns.push({
          name: pkMatch[1],
          type: pkMatch[2],
          nullable: false,
          primaryKey: true,
        });
      }
    }

    if (columns.length > 0) {
      tables.push({ name: tableName, columns, indexes, foreignKeys });
    }

    return tables;
  }

  private findMigrationFiles(root: string): string[] {
    const migFiles: string[] = [];
    const searchDirs = ['migrations', 'db/migrations', 'prisma/migrations', 'database/migrations', 'src/migrations'];

    for (const dir of searchDirs) {
      try {
        const files = findFiles(`${root}/${dir}`, ['*.sql', '*.ts', '*.js']);
        migFiles.push(...files);
      } catch {
        // directory not found
      }
    }

    return migFiles;
  }

  diffSchema(oldSchema: TableSchema[], newSchema: TableSchema[]): SchemaDiff {
    const changes: SchemaChange[] = [];
    const oldMap = new Map<string, TableSchema>();
    const newMap = new Map<string, TableSchema>();

    for (const t of oldSchema) oldMap.set(t.name, t);
    for (const t of newSchema) newMap.set(t.name, t);

    const addedTables: string[] = [];
    const removedTables: string[] = [];
    const modifiedTables: string[] = [];

    for (const name of newMap.keys()) {
      if (!oldMap.has(name)) {
        addedTables.push(name);
        changes.push({ type: 'added', table: name });
      }
    }

    for (const name of oldMap.keys()) {
      if (!newMap.has(name)) {
        removedTables.push(name);
        changes.push({ type: 'removed', table: name });
      }
    }

    for (const name of oldMap.keys()) {
      if (!newMap.has(name)) continue;
      const oldT = oldMap.get(name)!;
      const newT = newMap.get(name)!;

      const oldCols = new Map<string, ColumnSchema>();
      const newCols = new Map<string, ColumnSchema>();
      for (const c of oldT.columns) oldCols.set(c.name, c);
      for (const c of newT.columns) newCols.set(c.name, c);

      for (const cName of newCols.keys()) {
        if (!oldCols.has(cName)) {
          changes.push({ type: 'added', table: name, column: cName });
        } else {
          const oc = oldCols.get(cName)!;
          const nc = newCols.get(cName)!;
          if (oc.type !== nc.type || oc.nullable !== nc.nullable) {
            changes.push({
              type: 'modified',
              table: name,
              column: cName,
              oldType: oc.type,
              newType: nc.type,
            });
          }
        }
      }

      for (const cName of oldCols.keys()) {
        if (!newCols.has(cName)) {
          changes.push({ type: 'removed', table: name, column: cName });
        }
      }
    }

    return { changes, addedTables, removedTables, modifiedTables };
  }

  validateAgainstCode(tables: TableSchema[], modelFiles: string[]): Array<{ type: string; message: string }> {
    const findings: Array<{ type: string; message: string }> = [];

    // Check for tables without primary keys
    for (const table of tables) {
      if (!table.columns.some((c) => c.primaryKey)) {
        findings.push({
          type: 'warning',
          message: `Table "${table.name}" has no primary key`,
        });
      }

      // Check for tables with no columns
      if (table.columns.length === 0) {
        findings.push({
          type: 'warning',
          message: `Table "${table.name}" has no columns defined`,
        });
      }
    }

    return findings;
  }
}

export function printDBSchema(): void {
  const analyzer = new DBSchemaAnalyzer();
  const report = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow dbschema]\n'));

  console.log(chalk.bold(`Tables found: ${report.tables.length}`));
  console.log(chalk.bold(`Model files: ${report.modelFiles.length}`));
  console.log(chalk.bold(`Migration files: ${report.migrationHistory.length}`));
  console.log();

  if (report.tables.length > 0) {
    console.log(chalk.bold('Database Schema:'));
    for (const table of report.tables) {
      console.log(`  ${chalk.cyan.bold(table.name)} (${table.columns.length} columns, ${table.foreignKeys.length} FKs, ${table.indexes.length} indexes)`);
      for (const col of table.columns.slice(0, 5)) {
        const pk = col.primaryKey ? chalk.yellow(' PK') : '';
        const nullable = col.nullable ? chalk.dim('?') : '';
        const defaultVal = col.defaultValue ? chalk.dim(` = ${col.defaultValue}`) : '';
        console.log(`    ${chalk.white(col.name)}: ${chalk.magenta(col.type)}${pk}${nullable}${defaultVal}`);
      }
      if (table.columns.length > 5) {
        console.log(chalk.dim(`    ... and ${table.columns.length - 5} more columns`));
      }
    }
  } else {
    console.log(chalk.yellow('No database schema found. Supported: Prisma, TypeORM.'));
  }

  if (report.modelFiles.length > 0) {
    console.log(chalk.bold('\nModel files:'));
    for (const file of report.modelFiles) {
      console.log(`  ${chalk.dim('📄')} ${file}`);
    }
  }

  if (report.migrationHistory.length > 0) {
    console.log(chalk.bold('\nMigrations:'));
    for (const mig of report.migrationHistory.slice(0, 10)) {
      console.log(`  ${chalk.dim('↳')} ${mig}`);
    }
  }

  // Run validation
  const findings = analyzer.validateAgainstCode(report.tables, report.modelFiles);
  if (findings.length > 0) {
    console.log(chalk.bold.yellow('\nValidation findings:'));
    for (const f of findings) {
      console.log(`  ${chalk.yellow('⚠')} ${f.message}`);
    }
  }

  console.log();
}
