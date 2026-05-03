import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface APIContract {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';
  handler: string;
  file: string;
  line: number;
  requestBody?: Record<string, string>;
  responseBody?: Record<string, string>;
  queryParams?: string[];
  pathParams?: string[];
  headers?: string[];
  framework: string;
}

export interface ContractValidation {
  contract: APIContract;
  valid: boolean;
  issues: ContractIssue[];
}

export interface ContractIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export interface ContractChange {
  path: string;
  method: string;
  type: 'added' | 'removed' | 'modified';
  old?: APIContract;
  new?: APIContract;
  breaking: boolean;
  description: string;
}

export class APIContractExtractor {
  extract(projectPath?: string): APIContract[] {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const contracts: APIContract[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        contracts.push(...this.extractExpressRoutes(content, file));
        contracts.push(...this.extractFastifyRoutes(content, file));
        contracts.push(...this.extractPythonRoutes(content, file));
        contracts.push(...this.extractGoRoutes(content, file));
        contracts.push(...this.extractRustRoutes(content, file));
      } catch {
        // skip
      }
    }

    return contracts;
  }

  private extractExpressRoutes(content: string, file: string): APIContract[] {
    const contracts: APIContract[] = [];
    const lines = content.split('\n');

    const routeRegex = /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/gi;
    let match: RegExpExecArray | null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const routeRegexLocal = /(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/i;
      const rm = line.match(routeRegexLocal);
      if (rm) {
        contracts.push({
          path: rm[2],
          method: rm[1].toUpperCase() as APIContract['method'],
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'express',
          queryParams: this.extractPathParams(rm[2]),
        });
      }
    }

    return contracts;
  }

  private extractFastifyRoutes(content: string, file: string): APIContract[] {
    const contracts: APIContract[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/fastify\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/i);
      if (match) {
        contracts.push({
          path: match[2],
          method: match[1].toUpperCase() as APIContract['method'],
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'fastify',
          queryParams: this.extractPathParams(match[2]),
        });
      }
    }

    return contracts;
  }

  private extractPythonRoutes(content: string, file: string): APIContract[] {
    const contracts: APIContract[] = [];
    const lines = content.split('\n');

    // Flask: @app.route('/path', methods=['GET'])
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const decoratorMatch = line.match(/@(?:app|bp)\.route\s*\(\s*['"]([^'"]+)['"]/);
      if (decoratorMatch) {
        const methodMatch = line.match(/methods\s*=\s*\[(['"]([^'"]+)['"]\s*,?\s*)*\]/);
        const methods = methodMatch
          ? Array.from(line.matchAll(/['"]([^'"]+)['"]/g)).map((m) => m[1].toUpperCase())
          : ['GET'];
        for (const method of methods) {
          contracts.push({
            path: decoratorMatch[1],
            method: method as APIContract['method'],
            handler: 'view',
            file,
            line: i + 1,
            framework: 'flask',
            queryParams: this.extractPathParams(decoratorMatch[1]),
          });
        }
      }
    }

    // FastAPI: @app.get('/path')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/@(?:app|router)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/i);
      if (match) {
        contracts.push({
          path: match[2],
          method: match[1].toUpperCase() as APIContract['method'],
          handler: 'endpoint',
          file,
          line: i + 1,
          framework: 'fastapi',
          queryParams: this.extractPathParams(match[2]),
        });
      }
    }

    return contracts;
  }

  private extractGoRoutes(content: string, file: string): APIContract[] {
    const contracts: APIContract[] = [];
    const lines = content.split('\n');

    // Gin: router.GET("/path", handler)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/\.(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\s*\(\s*"([^"]+)"/i);
      if (match) {
        contracts.push({
          path: match[2],
          method: match[1].toUpperCase() as APIContract['method'],
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'gin',
          queryParams: this.extractPathParams(match[2]),
        });
      }
    }

    // Chi/standard: mux.HandleFunc("/path", handler)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/HandleFunc\s*\(\s*"([^"]+)"/);
      if (match) {
        contracts.push({
          path: match[1],
          method: 'GET',
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'chi/net/http',
          queryParams: this.extractPathParams(match[1]),
        });
      }
    }

    return contracts;
  }

  private extractRustRoutes(content: string, file: string): APIContract[] {
    const contracts: APIContract[] = [];
    const lines = content.split('\n');

    // Actix: #[get("/path")]
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/#\[(get|post|put|delete|patch|options|head)\s*\(\s*"([^"]+)"/i);
      if (match) {
        contracts.push({
          path: match[2],
          method: match[1].toUpperCase() as APIContract['method'],
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'actix-web',
          queryParams: this.extractPathParams(match[2]),
        });
      }
    }

    // Rocket: #[get("/path")]
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/#\[(get|post|put|delete|patch)\s*\(\s*"([^"]+)"/i);
      if (match) {
        contracts.push({
          path: match[2],
          method: match[1].toUpperCase() as APIContract['method'],
          handler: 'handler',
          file,
          line: i + 1,
          framework: 'rocket',
          queryParams: this.extractPathParams(match[2]),
        });
      }
    }

    return contracts;
  }

  private extractPathParams(path: string): string[] {
    const params: string[] = [];
    const colonMatch = path.matchAll(/:(\w+)/g);
    for (const m of colonMatch) {
      params.push(m[1]);
    }
    const curlyMatch = path.matchAll(/\{(\w+)\}/g);
    for (const m of curlyMatch) {
      params.push(m[1]);
    }
    return params;
  }

  validateContract(contract: APIContract): ContractValidation {
    const issues: ContractIssue[] = [];

    if (!contract.path.startsWith('/')) {
      issues.push({ severity: 'warning', message: 'Path should start with /', field: 'path' });
    }

    if (contract.path.includes('//')) {
      issues.push({ severity: 'warning', message: 'Path contains double slash', field: 'path' });
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    if (!validMethods.includes(contract.method)) {
      issues.push({ severity: 'error', message: `Invalid HTTP method: ${contract.method}`, field: 'method' });
    }

    // Check for common naming conventions
    if (/[A-Z]/.test(contract.path)) {
      issues.push({ severity: 'info', message: 'Path uses uppercase letters (should be lowercase)', field: 'path' });
    }

    if (contract.path.includes('_')) {
      issues.push({ severity: 'info', message: 'Path uses underscores (kebab-case recommended)', field: 'path' });
    }

    return {
      contract,
      valid: !issues.some((i) => i.severity === 'error'),
      issues,
    };
  }

  detectBreakingChanges(old: APIContract[], current: APIContract[]): ContractChange[] {
    const changes: ContractChange[] = [];

    const oldMap = new Map<string, APIContract>();
    for (const c of old) {
      oldMap.set(`${c.method}:${c.path}`, c);
    }

    const newMap = new Map<string, APIContract>();
    for (const c of current) {
      newMap.set(`${c.method}:${c.path}`, c);
    }

    // Removed
    for (const [key, contract] of oldMap.entries()) {
      if (!newMap.has(key)) {
        changes.push({
          path: contract.path,
          method: contract.method,
          type: 'removed',
          old: contract,
          breaking: true,
          description: `Endpoint ${contract.method} ${contract.path} was removed`,
        });
      }
    }

    // Added
    for (const [key, contract] of newMap.entries()) {
      if (!oldMap.has(key)) {
        changes.push({
          path: contract.path,
          method: contract.method,
          type: 'added',
          new: contract,
          breaking: false,
          description: `New endpoint ${contract.method} ${contract.path} added`,
        });
      }
    }

    // Modified
    for (const [key, oldContract] of oldMap.entries()) {
      const newContract = newMap.get(key);
      if (newContract) {
        const mods: string[] = [];

        const oldParams = new Set(oldContract.pathParams || []);
        const newParams = new Set(newContract.pathParams || []);

        const removedParams = Array.from(oldParams).filter((p) => !newParams.has(p));
        if (removedParams.length > 0) {
          mods.push(`removed path params: ${removedParams.join(', ')}`);
        }

        if (oldContract.requestBody !== newContract.requestBody) {
          mods.push('request body changed');
        }

        if (mods.length > 0) {
          changes.push({
            path: key,
            method: oldContract.method,
            type: 'modified',
            old: oldContract,
            new: newContract,
            breaking: true,
            description: mods.join('; '),
          });
        }
      }
    }

    return changes;
  }

  generateContractTests(contract: APIContract): string {
    const lines: string[] = [];

    lines.push(`// Auto-generated contract test for ${contract.method} ${contract.path}`);
    lines.push(`// Generated from ${contract.file}:${contract.line}`);
    lines.push('');

    lines.push(`describe('${contract.method} ${contract.path}', () => {`);
    lines.push(`  it('should return a valid response', async () => {`);
    lines.push(`    const response = await request(app)`);
    lines.push(`      .${contract.method.toLowerCase()}('${contract.path}')`);

    if (contract.requestBody) {
      lines.push(`      .send({})`);
    }

    lines.push(`      .expect(${contract.method === 'POST' ? 201 : 200});`);
    lines.push('  });');
    lines.push(''); 
    lines.push(`  it('should return ${contract.method === 'DELETE' ? '404' : '200'} for ${contract.method} ${contract.path}', async () => {`);
    lines.push('    // TODO: Add specific test assertions');
    lines.push('  });');
    lines.push('});');

    return lines.join('\n');
  }
}

export function printAPIContracts(): void {
  const extractor = new APIContractExtractor();
  const contracts = extractor.extract();

  console.log(chalk.bold.blue('\n[shadow apicontract]\n'));

  const byFramework: Record<string, number> = {};
  for (const c of contracts) {
    byFramework[c.framework] = (byFramework[c.framework] || 0) + 1;
  }

  console.log(chalk.bold(`Endpoints found: ${contracts.length}`));
  for (const [fw, count] of Object.entries(byFramework).sort()) {
    console.log(`  ${chalk.cyan(fw)}: ${count}`);
  }
  console.log();

  if (contracts.length > 0) {
    console.log(chalk.bold('Endpoints:'));
    const methodsByColor: Record<string, (s: string) => string> = {
      'GET': chalk.green,
      'POST': chalk.blue,
      'PUT': chalk.yellow,
      'DELETE': chalk.red,
      'PATCH': chalk.magenta,
    };

    for (const c of contracts.slice(0, 30)) {
      const methodColor = methodsByColor[c.method] || chalk.gray;
      console.log(`  ${methodColor(c.method.padEnd(7))} ${chalk.white(c.path)} ${chalk.dim(`(${c.framework} - ${c.file}:${c.line})`)}`);
    }

    if (contracts.length > 30) {
      console.log(chalk.dim(`  ... and ${contracts.length - 30} more`));
    }
  }

  // Validate contracts
  let validCount = 0;
  let invalidCount = 0;
  const issues: ContractIssue[] = [];
  for (const c of contracts) {
    const validation = extractor.validateContract(c);
    if (validation.valid) validCount++;
    else invalidCount++;
    issues.push(...validation.issues);
  }

  console.log();
  console.log(chalk.bold('Validation:'));
  console.log(`  ${chalk.green('Valid')}: ${validCount}`);
  console.log(`  ${chalk.red('Invalid')}: ${invalidCount}`);

  if (issues.length > 0) {
    console.log(chalk.bold.yellow('\nIssues:'));
    for (const issue of issues.slice(0, 10)) {
      const sev = issue.severity === 'error' ? chalk.red : issue.severity === 'warning' ? chalk.yellow : chalk.gray;
      console.log(`  ${sev(`[${issue.severity}]`)} ${issue.message}`);
    }
  }
  console.log();
}
