import { DeployCheck } from '../../types';

export interface DeployScore {
  overall: number;
  categories: Record<string, { score: number; weight: number; label: string }>;
  summary: string;
  recommendations: string[];
}

export function calculateDeployScore(
  dockerChecks: DeployCheck[],
  k8sChecks: DeployCheck[],
  envChecks: DeployCheck[],
  buildChecks: DeployCheck[],
  smokeChecks: DeployCheck[],
  securityChecks: DeployCheck[],
): DeployScore {
  const categories: Record<string, { score: number; weight: number; label: string }> = {
    docker: { score: computeCategoryScore(dockerChecks), weight: 0.20, label: 'Docker readiness' },
    kubernetes: { score: computeCategoryScore(k8sChecks), weight: 0.20, label: 'Kubernetes readiness' },
    environment: { score: computeCategoryScore(envChecks), weight: 0.20, label: 'Environment config' },
    build: { score: computeCategoryScore(buildChecks), weight: 0.15, label: 'Build health' },
    smoke: { score: computeCategoryScore(smokeChecks), weight: 0.15, label: 'Smoke tests' },
    security: { score: computeCategoryScore(securityChecks), weight: 0.10, label: 'Security scan' },
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const cat of Object.values(categories)) {
    if (cat.score >= 0) {
      weightedSum += cat.score * cat.weight;
      totalWeight += cat.weight;
    }
  }

  const overall = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const recommendations = generateRecommendations(
    dockerChecks,
    k8sChecks,
    envChecks,
    buildChecks,
    smokeChecks,
    securityChecks,
  );

  const summary = getScoreSummary(overall);

  return { overall, categories, summary, recommendations };
}

function computeCategoryScore(checks: DeployCheck[]): number {
  if (checks.length === 0) return -1; // No checks run for this category

  const statusWeights: Record<DeployCheck['status'], number> = {
    pass: 100,
    warn: 50,
    fail: 0,
  };

  const total = checks.reduce((sum, c) => sum + statusWeights[c.status], 0);
  return Math.round(total / checks.length);
}

function generateRecommendations(
  dockerChecks: DeployCheck[],
  k8sChecks: DeployCheck[],
  envChecks: DeployCheck[],
  buildChecks: DeployCheck[],
  smokeChecks: DeployCheck[],
  securityChecks: DeployCheck[],
): string[] {
  const recommendations: string[] = [];
  const allChecks = [
    ...dockerChecks,
    ...k8sChecks,
    ...envChecks,
    ...buildChecks,
    ...smokeChecks,
    ...securityChecks,
  ];

  const failures = allChecks.filter((c) => c.status === 'fail');
  const warnings = allChecks.filter((c) => c.status === 'warn');

  if (failures.length > 0) {
    recommendations.push(
      `${failures.length} critical issue(s) must be resolved before deployment`,
    );
    for (const f of failures) {
      recommendations.push(`[CRITICAL] ${f.name}: ${f.message}`);
    }
  }

  if (warnings.length > 0) {
    recommendations.push(
      `${warnings.length} warning(s) should be reviewed`,
    );
  }

  if (failures.length === 0 && warnings.length === 0) {
    recommendations.push('No issues found — project is ready for deployment');
  }

  return recommendations;
}

function getScoreSummary(score: number): string {
  if (score >= 90) return 'Excellent — ready for production deployment';
  if (score >= 75) return 'Good — minor improvements recommended before production';
  if (score >= 50) return 'Fair — address warnings before deployment';
  if (score >= 25) return 'Poor — significant issues must be resolved';
  return 'Critical — not ready for deployment';
}
