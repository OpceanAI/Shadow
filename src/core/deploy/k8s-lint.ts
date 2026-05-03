import { readFile, fileExists, findFiles } from '../../utils/fs';
import { DeployCheck } from '../../types';

export interface K8sLintResult {
  checks: DeployCheck[];
  score: number;
}

export function lintKubernetesManifests(root: string): K8sLintResult {
  const checks: DeployCheck[] = [];
  const k8sFiles = findK8sFiles(root);

  if (k8sFiles.length === 0) {
    checks.push({
      name: 'Kubernetes manifests',
      status: 'warn',
      message: 'No Kubernetes manifests found',
    });
    return { checks, score: checks.length > 0 ? 50 : 75 };
  }

  checks.push({
    name: 'K8s manifests found',
    status: 'pass' as const,
    message: `Found ${k8sFiles.length} Kubernetes manifest file(s)`,
  });

  for (const file of k8sFiles) {
    try {
      const content = readFile(file);
      validateManifestContent(file, content, checks);
    } catch {
      checks.push({
        name: `Parse: ${file}`,
        status: 'fail',
        message: 'Failed to read manifest',
      });
    }
  }

  const passed = checks.filter((c) => c.status === 'pass').length;
  const total = checks.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;

  return { checks, score };
}

function findK8sFiles(root: string): string[] {
  const yamlCandidates = [
    ...findFiles(root, ['*.yaml']),
    ...findFiles(root, ['*.yml']),
  ];

  return yamlCandidates.filter((f) => {
    const relative = f.replace(root, '');
    return (
      relative.includes('k8s') ||
      relative.includes('kube') ||
      relative.includes('deploy') ||
      relative.includes('helm')
    );
  });
}

function validateManifestContent(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const lines = content.split('\n');
  const joined = content;

  checkKind(filename, joined, checks);
  checkMetadata(filename, joined, checks);
  checkResourceLimits(filename, joined, checks);
  checkProbes(filename, joined, checks);
  checkReplicas(filename, joined, checks);
  checkNamespace(filename, joined, checks);
  checkLabels(filename, joined, checks);
}

function checkKind(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const hasKind = /^kind:\s*\S+\s*$/m.test(content);
  checks.push({
    name: `Kind field: ${filename}`,
    status: hasKind ? 'pass' : 'fail',
    message: hasKind
      ? 'kind field present'
      : 'Missing kind field — not a valid Kubernetes resource',
  });
}

function checkMetadata(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const hasName = /^\s+name:\s*\S+\s*$/m.test(content);
  const hasNamespace = /^\s+namespace:\s*\S+\s*$/m.test(content);
  checks.push({
    name: `Metadata: ${filename}`,
    status: hasName && hasNamespace ? 'pass' : 'warn',
    message: hasName && hasNamespace
      ? 'name and namespace defined'
      : 'Consider adding name and namespace to metadata',
  });
}

function checkResourceLimits(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const hasResources = /^\s+resources:\s*$/m.test(content);
  const hasLimits = /^\s+limits:\s*$/m.test(content);
  const hasRequests = /^\s+requests:\s*$/m.test(content);

  if (!hasResources) {
    checks.push({
      name: `Resource limits: ${filename}`,
      status: 'warn',
      message: 'No resource limits defined — containers may consume unbounded resources',
    });
  } else if (!hasLimits && !hasRequests) {
    checks.push({
      name: `Resource limits: ${filename}`,
      status: 'warn',
      message: 'Resources section present but no limits or requests specified',
    });
  } else {
    const parts: string[] = [];
    if (hasLimits) parts.push('limits');
    if (hasRequests) parts.push('requests');
    checks.push({
      name: `Resource limits: ${filename}`,
      status: 'pass',
      message: `Resource ${parts.join(' and ')} defined`,
    });
  }
}

function checkProbes(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const hasLiveness = /^\s+livenessProbe:\s*$/m.test(content);
  const hasReadiness = /^\s+readinessProbe:\s*$/m.test(content);

  if (hasLiveness && hasReadiness) {
    checks.push({
      name: `Probes: ${filename}`,
      status: 'pass',
      message: 'livenessProbe and readinessProbe defined',
    });
  } else if (hasLiveness || hasReadiness) {
    const missing = hasLiveness ? 'readinessProbe' : 'livenessProbe';
    checks.push({
      name: `Probes: ${filename}`,
      status: 'warn',
      message: `Missing ${missing}`,
    });
  } else {
    checks.push({
      name: `Probes: ${filename}`,
      status: 'fail',
      message: 'No livenessProbe or readinessProbe — critical for production',
    });
  }
}

function checkReplicas(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  if (!/^kind:\s*Deployment\s*$/m.test(content)) return;

  const hasReplicas = /^\s+replicas:\s*\d+\s*$/m.test(content);
  checks.push({
    name: `Replicas: ${filename}`,
    status: hasReplicas ? 'pass' : 'warn',
    message: hasReplicas
      ? 'replicas field defined'
      : 'replicas not set — defaults to 1',
  });
}

function checkNamespace(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  if (/^kind:\s*Namespace\s*$/m.test(content)) return;

  const hasNamespace = /^\s+namespace:\s*\S+\s*$/m.test(content);
  checks.push({
    name: `Namespace: ${filename}`,
    status: hasNamespace ? 'pass' : 'warn',
    message: hasNamespace
      ? 'namespace specified'
      : 'No namespace — will deploy to default namespace',
  });
}

function checkLabels(
  filename: string,
  content: string,
  checks: DeployCheck[],
): void {
  const hasLabels = /^\s+labels:\s*$/m.test(content);
  checks.push({
    name: `Labels: ${filename}`,
    status: hasLabels ? 'pass' : 'warn',
    message: hasLabels
      ? 'labels defined'
      : 'Consider adding labels for organization and selection',
  });
}
