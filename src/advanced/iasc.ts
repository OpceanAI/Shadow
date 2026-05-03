import { readFile, findFiles, fileExists } from '../utils/fs';
import chalk from 'chalk';

export interface IaCResource {
  id: string;
  type: string;
  name: string;
  file: string;
  line: number;
  properties: Record<string, string>;
}

export interface IaCDependency {
  from: string;
  to: string;
  type: 'depends_on' | 'references' | 'uses';
}

export interface IaCResourceGraph {
  resources: IaCResource[];
  dependencies: IaCDependency[];
}

export interface SecurityGroupRule {
  resource: string;
  direction: 'ingress' | 'egress';
  protocol: string;
  fromPort: number;
  toPort: number;
  cidr: string;
  description: string;
}

export interface SecurityAnalysis {
  openToWorld: SecurityGroupRule[];
  overlyPermissive: SecurityGroupRule[];
  missingEncryption: string[];
  hardcodedSecrets: Array<{ file: string; line: number }>;
}

export interface CostEstimate {
  resource: string;
  type: string;
  estimatedMonthlyCost: number;
  notes: string;
}

export class IaCAnalyzer {
  analyze(projectPath?: string): IaCResourceGraph {
    const root = projectPath || process.cwd();
    const resources: IaCResource[] = [];
    const dependencies: IaCDependency[] = [];

    // Parse Terraform files
    const tfFiles = findFiles(root, ['*.tf']);
    for (const file of tfFiles) {
      try {
        const content = readFile(file);
        resources.push(...this.parseTerraform(content, file));
      } catch {
        // skip
      }
    }

    // Parse CloudFormation / SAM templates
    const cfFiles = findFiles(root, ['*.yaml', '*.yml', '*.json']).filter((f) => {
      try {
        const content = readFile(f);
        return content.includes('AWSTemplateFormatVersion') || content.includes('Transform: AWS::Serverless');
      } catch {
        return false;
      }
    });

    for (const file of cfFiles) {
      try {
        const content = readFile(file);
        resources.push(...this.parseCloudFormation(content, file));
      } catch {
        // skip
      }
    }

    // Parse Pulumi files
    const pulumiFiles = findFiles(root, ['*.ts', '*.py', '*.go']).filter((f) => {
      try {
        const content = readFile(f);
        return content.includes('@pulumi') || content.includes('pulumi_') || content.includes('pulumi.');
      } catch {
        return false;
      }
    });

    for (const file of pulumiFiles) {
      try {
        const content = readFile(file);
        resources.push(...this.parsePulumi(content, file));
      } catch {
        // skip
      }
    }

    // Build dependencies from references
    for (let i = 0; i < resources.length; i++) {
      for (let j = 0; j < resources.length; j++) {
        if (i === j) continue;
        for (const [, value] of Object.entries(resources[i].properties)) {
          if (value.includes(resources[j].name) || value.includes(resources[j].id)) {
            dependencies.push({
              from: resources[i].id,
              to: resources[j].id,
              type: 'references',
            });
          }
        }
      }
    }

    return { resources, dependencies };
  }

  private parseTerraform(content: string, file: string): IaCResource[] {
    const resources: IaCResource[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const localMatch = lines[i].match(/resource\s+"(\w+)"\s+"(\w+)"/);
      if (localMatch) {
        const type = localMatch[1];
        const name = localMatch[2];
        const properties: Record<string, string> = {};

        // Read properties until closing brace
        for (let j = i + 1; j < Math.min(i + 30, lines.length); j++) {
          const propLine = lines[j];
          const propMatch = propLine.match(/(\w+)\s*=\s*"([^"]*)"/);
          if (propMatch) {
            properties[propMatch[1]] = propMatch[2];
          }
          if (propLine.includes('}')) break;
        }

        resources.push({
          id: `${type}.${name}`,
          type,
          name,
          file,
          line: i + 1,
          properties,
        });
      }
    }

    return resources;
  }

  private parseCloudFormation(content: string, file: string): IaCResource[] {
    const resources: IaCResource[] = [];

    // Simple regex-based CloudFormation parsing
    const lines = content.split('\n');
    let currentResource = '';
    let currentType = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const resStart = line.match(/^  (\w+):\s*$/);
      if (resStart && lines[i + 1]?.includes('Type:')) {
        currentResource = resStart[1];
      }

      const typeMatch = line.match(/Type:\s*(?:AWS::)?(\S+)/);
      if (typeMatch && currentResource) {
        currentType = typeMatch[1];

        resources.push({
          id: currentResource,
          type: currentType,
          name: currentResource,
          file,
          line: i + 1,
          properties: {},
        });

        currentResource = '';
      }
    }

    return resources;
  }

  private parsePulumi(content: string, file: string): IaCResource[] {
    const resources: IaCResource[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const newMatch = line.match(/new\s+(\w+)\.(\w+)\(['"]?(\w+)['"]?/);
      if (newMatch) {
        const provider = newMatch[1];
        const resourceType = newMatch[2];
        const name = newMatch[3];

        resources.push({
          id: `${provider}.${resourceType}.${name}`,
          type: `${provider}/${resourceType}`,
          name,
          file,
          line: i + 1,
          properties: { provider },
        });
      }
    }

    return resources;
  }

  analyzeSecurity(graph: IaCResourceGraph): SecurityAnalysis {
    const analysis: SecurityAnalysis = {
      openToWorld: [],
      overlyPermissive: [],
      missingEncryption: [],
      hardcodedSecrets: [],
    };

    // Find security groups and their rules
    for (const resource of graph.resources) {
      // Check for open-to-world security groups (0.0.0.0/0)
      if (resource.type.includes('security_group') || resource.type.includes('SecurityGroup')) {
        for (const [key, value] of Object.entries(resource.properties)) {
          if (value === '0.0.0.0/0' || value === '::/0') {
            analysis.openToWorld.push({
              resource: resource.name,
              direction: 'ingress',
              protocol: resource.properties.protocol || 'tcp',
              fromPort: parseInt(resource.properties.from_port || '0', 10),
              toPort: parseInt(resource.properties.to_port || '65535', 10),
              cidr: value,
              description: `${resource.name} is open to the world on port ${resource.properties.from_port || '0'}` || `${resource.name} is publicly accessible`,
            });
          }
        }

        // Check for overly permissive rules
        if (resource.properties.from_port === '0' && resource.properties.to_port === '65535') {
          analysis.overlyPermissive.push({
            resource: resource.name,
            direction: 'ingress',
            protocol: 'all',
            fromPort: 0,
            toPort: 65535,
            cidr: resource.properties.cidr_blocks || 'unknown',
            description: `${resource.name} allows all ports`,
          });
        }
      }

      // Check for unencrypted resources
      if (
        (resource.type.includes('bucket') || resource.type.includes('Bucket')) &&
        !Object.values(resource.properties).some((v) => v.includes('encrypt'))
      ) {
        analysis.missingEncryption.push(`${resource.name} (storage bucket without encryption)`);
      }

      if (
        (resource.type.includes('db_instance') || resource.type.includes('DBInstance')) &&
        !Object.values(resource.properties).some((v) => v.toLowerCase().includes('encrypt'))
      ) {
        analysis.missingEncryption.push(`${resource.name} (database without encryption)`);
      }
    }

    // Find hardcoded secrets in IaC files
    for (const resource of graph.resources) {
      for (const [key, value] of Object.entries(resource.properties)) {
        if (
          (key.includes('password') || key.includes('secret') || key.includes('key') || key.includes('token')) &&
          value.length > 3 &&
          !value.includes('var.') &&
          !value.includes('${')
        ) {
          analysis.hardcodedSecrets.push({
            file: resource.file,
            line: resource.line,
          });
        }
      }
    }

    return analysis;
  }

  estimateCosts(graph: IaCResourceGraph): CostEstimate[] {
    const estimates: CostEstimate[] = [];

    const costMap: Record<string, { hourly: number; notes: string }> = {
      'aws_instance': { hourly: 0.04, notes: 't3.medium (~$29/mo)' },
      'aws_lambda_function': { hourly: 0, notes: 'Pay-per-use (~$0-$5/mo)' },
      'aws_s3_bucket': { hourly: 0, notes: 'Storage cost (~$0.023/GB)' },
      'aws_rds_instance': { hourly: 0.05, notes: 'db.t3.micro (~$35/mo)' },
      'aws_dynamodb_table': { hourly: 0, notes: 'Pay-per-use (~$0-$10/mo)' },
      'aws_ecs_service': { hourly: 0.10, notes: 'Fargate 0.25 vCPU (~$72/mo)' },
      'aws_eks_cluster': { hourly: 0.10, notes: 'Control plane (~$73/mo)' },
      'aws_elasticache_cluster': { hourly: 0.03, notes: 'cache.t3.micro (~$22/mo)' },
      'aws_lb': { hourly: 0.0225, notes: 'ALB (~$16/mo)' },
      'aws_nat_gateway': { hourly: 0.045, notes: 'NAT Gateway (~$33/mo)' },
      'google_compute_instance': { hourly: 0.04, notes: 'n1-standard-1 (~$29/mo)' },
      'azurerm_virtual_machine': { hourly: 0.04, notes: 'B1s (~$29/mo)' },
    };

    for (const resource of graph.resources) {
      for (const [typeKey, costInfo] of Object.entries(costMap)) {
        if (resource.type.includes(typeKey) || resource.type.toLowerCase().includes(typeKey.replace(/_/g, ''))) {
          estimates.push({
            resource: resource.name,
            type: resource.type,
            estimatedMonthlyCost: Math.round(costInfo.hourly * 24 * 30),
            notes: costInfo.notes,
          });
        }
      }
    }

    return estimates;
  }
}

export function printIaC(): void {
  const analyzer = new IaCAnalyzer();
  const graph = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow iasc]\n'));

  if (graph.resources.length === 0) {
    console.log(chalk.yellow('No Infrastructure as Code files found.'));
    console.log(chalk.dim('Supported: Terraform (.tf), CloudFormation, Pulumi'));
    console.log();
    return;
  }

  const byType: Record<string, number> = {};
  for (const r of graph.resources) {
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  console.log(chalk.bold(`Resources: ${graph.resources.length}`));
  console.log(chalk.bold(`Dependencies: ${graph.dependencies.length}`));
  console.log();

  console.log(chalk.bold('Resources by type:'));
  for (const [type, count] of Object.entries(byType).sort()) {
    console.log(`  ${chalk.cyan(type)}: ${count}`);
  }
  console.log();

  // Security analysis
  const security = analyzer.analyzeSecurity(graph);
  console.log(chalk.bold('Security Analysis:'));
  console.log(`  ${chalk.red('Open to world:')} ${security.openToWorld.length}`);
  console.log(`  ${chalk.yellow('Overly permissive:')} ${security.overlyPermissive.length}`);
  console.log(`  ${chalk.yellow('Missing encryption:')} ${security.missingEncryption.length}`);
  console.log(`  ${chalk.red('Hardcoded secrets:')} ${security.hardcodedSecrets.length}`);

  if (security.openToWorld.length > 0) {
    console.log(chalk.bold.red('\n  Resources open to the world:'));
    for (const r of security.openToWorld) {
      console.log(`    ${chalk.red('⚠')} ${r.resource} - ${r.description}`);
    }
  }

  if (security.hardcodedSecrets.length > 0) {
    console.log(chalk.bold.red('\n  Hardcoded secrets:'));
    for (const s of security.hardcodedSecrets) {
      console.log(`    ${chalk.red('⛔')} ${s.file}:${s.line}`);
    }
  }

  // Cost estimates
  const costs = analyzer.estimateCosts(graph);
  if (costs.length > 0) {
    console.log(chalk.bold('\nCost Estimates:'));
    const total = costs.reduce((sum, c) => sum + c.estimatedMonthlyCost, 0);
    for (const c of costs) {
      console.log(`  ${chalk.cyan(c.resource)} (${c.type}): ${chalk.yellow(`~$${c.estimatedMonthlyCost}/mo`)} ${chalk.dim(`- ${c.notes}`)}`);
    }
    console.log(`  ${chalk.bold(`Estimated total: ~$${total}/mo`)}`);
  }

  console.log();
}
