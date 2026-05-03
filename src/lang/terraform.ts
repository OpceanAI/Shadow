export interface TerraformInfo {
  provider: string;
  resources: TerraformResource[];
  variables: TerraformVariable[];
  outputs: TerraformOutput[];
  modules: TerraformModule[];
  backend?: string;
}

export interface TerraformResource {
  type: string;
  name: string;
}

export interface TerraformVariable {
  name: string;
  type?: string;
  default?: string;
  description?: string;
}

export interface TerraformOutput {
  name: string;
  value?: string;
  description?: string;
}

export interface TerraformModule {
  name: string;
  source: string;
  version?: string;
}

export function parseTerraform(content: string): TerraformInfo {
  const info: TerraformInfo = {
    provider: 'unknown',
    resources: [],
    variables: [],
    outputs: [],
    modules: [],
  };

  const providerMatch = content.match(/(?:required_providers\s*\{[^}]*\bsource\s*=\s*"([^"]+)"|provider\s+"(\w+)")/s);
  if (providerMatch) {
    info.provider = providerMatch[2] || providerMatch[1] || 'unknown';
  }

  const resourceRegex = /resource\s+"(\w+)"\s+"(\w+)"/g;
  let match;
  while ((match = resourceRegex.exec(content)) !== null) {
    info.resources.push({ type: match[1], name: match[2] });
  }

  const variableRegex = /variable\s+"(\w+)"\s*\{([^}]*)\}/gs;
  while ((match = variableRegex.exec(content)) !== null) {
    const varBlock = match[2];
    const typeMatch = varBlock.match(/type\s*=\s*(?:string\(\)|"(\w+)"|list\((\w+)\))/);
    const defaultMatch = varBlock.match(/default\s*=\s*(?:")?([^"\n]+)(?:")?/);
    const descMatch = varBlock.match(/description\s*=\s*"([^"]+)"/);
    info.variables.push({
      name: match[1],
      type: typeMatch?.[1] || typeMatch?.[2],
      default: defaultMatch?.[1]?.trim(),
      description: descMatch?.[1],
    });
  }

  const outputRegex = /output\s+"(\w+)"\s*\{([^}]*)\}/gs;
  while ((match = outputRegex.exec(content)) !== null) {
    const outBlock = match[2];
    const valueMatch = outBlock.match(/value\s*=\s*([^\n]+)/);
    const descMatch = outBlock.match(/description\s*=\s*"([^"]+)"/);
    info.outputs.push({
      name: match[1],
      value: valueMatch?.[1]?.trim(),
      description: descMatch?.[1],
    });
  }

  const moduleRegex = /module\s+"(\w+)"\s*\{([^}]*)\}/gs;
  while ((match = moduleRegex.exec(content)) !== null) {
    const modBlock = match[2];
    const sourceMatch = modBlock.match(/source\s*=\s*"([^"]+)"/);
    const versionMatch = modBlock.match(/version\s*=\s*"([^"]+)"/);
    info.modules.push({
      name: match[1],
      source: sourceMatch?.[1] || 'unknown',
      version: versionMatch?.[1],
    });
  }

  const backendMatch = content.match(/backend\s+"(\w+)"/);
  if (backendMatch) {
    info.backend = backendMatch[1];
  }

  return info;
}

export function analyzeTerraformSecurity(info: TerraformInfo): string[] {
  const warnings: string[] = [];

  const sensitiveResourceTypes = [
    'aws_s3_bucket', 'aws_db_instance', 'aws_secretsmanager_secret',
    'google_storage_bucket', 'azurerm_key_vault',
  ];

  for (const resource of info.resources) {
    if (sensitiveResourceTypes.includes(resource.type)) {
      warnings.push(`Sensitive resource "${resource.type}.${resource.name}" - ensure proper access controls`);
    }
  }

  const sensitivePatterns = [/password/, /secret/, /token/, /key/, /credential/];
  for (const v of info.variables) {
    if (sensitivePatterns.some((p) => p.test(v.name)) && !contentHasSensitive(v.name)) {
      warnings.push(`Variable "${v.name}" may contain sensitive data - consider marking as sensitive`);
    }
  }

  return warnings;
}

function contentHasSensitive(varName: string): boolean {
  return false;
}
