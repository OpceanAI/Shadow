import { ASTResult, ASTComplexity, ASTFunction } from './types';

export function computeFileComplexity(ast: ASTResult): ASTComplexity {
  return ast.complexity;
}

export function computeFunctionComplexity(func: ASTFunction, code: string): number {
  const body = code.slice(func.bodyStart, func.bodyEnd);

  let complexity = 1;

  const branchingPatterns = [
    /\bif\b/g,
    /\belif\b/g,
    /\belse\b/g,
    /\bfor\b/g,
    /\bwhile\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\bexcept\b/g,
    /\bmatch\b/g,
    /\bwhen\b/g,
    /\?\s*:/g,
    /\b&&\b/g,
    /\b\|\|\b/g,
  ];

  for (const pattern of branchingPatterns) {
    const matches = body.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

export function computeNestingDepth(code: string): number {
  const lines = code.split('\n');
  let maxDepth = 0;
  let currentDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('#')) continue;

    const openBraces = (trimmed.match(/\{/g) || []).length;
    const closeBraces = (trimmed.match(/\}/g) || []).length;

    if (closeBraces > 0 && openBraces === 0) {
      currentDepth = Math.max(0, currentDepth - closeBraces);
    } else {
      if (openBraces > 0) {
        currentDepth += openBraces;
      }
      if (closeBraces > 0) {
        currentDepth -= closeBraces;
      }
    }

    if (trimmed.endsWith('{') || trimmed.match(/^(\s*)(if|for|while|else|try|catch|match|def|class|fn|func|with)\b/)) {
      if (!trimmed.includes('{')) {
        currentDepth++;
      }
    }

    maxDepth = Math.max(maxDepth, currentDepth);
  }

  return maxDepth;
}

export function computeLinesOfCode(code: string): number {
  const lines = code.split('\n');
  return lines.filter((l) => {
    const trimmed = l.trim();
    return trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith('--');
  }).length;
}

export function analyzeFunctionMetrics(functions: ASTFunction[], code: string): {
  longFunctions: { name: string; lines: number }[];
  complexFunctions: { name: string; complexity: number }[];
  manyParams: { name: string; count: number }[];
} {
  const longFunctions: { name: string; lines: number }[] = [];
  const complexFunctions: { name: string; complexity: number }[] = [];
  const manyParams: { name: string; count: number }[] = [];

  for (const func of functions) {
    const body = code.slice(func.bodyStart, func.bodyEnd);
    const lines = body.split('\n').filter((l) => l.trim()).length;

    if (lines > 50) {
      longFunctions.push({ name: func.name, lines });
    }

    const complexity = computeFunctionComplexity(func, code);
    if (complexity > 10) {
      complexFunctions.push({ name: func.name, complexity });
    }

    if (func.params.length > 5) {
      manyParams.push({ name: func.name, count: func.params.length });
    }
  }

  return { longFunctions, complexFunctions, manyParams };
}

export function scoreFileQuality(ast: ASTResult): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  const comp = ast.complexity;

  if (comp.cyclomaticComplexity > 20) {
    score -= 10;
    issues.push(`High cyclomatic complexity (${comp.cyclomaticComplexity})`);
  }

  if (comp.nestingDepth > 4) {
    score -= 10;
    issues.push(`Deep nesting (depth ${comp.nestingDepth})`);
  }

  if (comp.linesOfCode > 500) {
    score -= 15;
    issues.push(`Large file (${comp.linesOfCode} LOC)`);
  }

  if (comp.functionLength > 30) {
    score -= 10;
    issues.push(`Long functions (avg ${comp.functionLength} lines)`);
  }

  if (comp.parameterCount > 5) {
    score -= 5;
    issues.push(`Functions with many parameters (max ${comp.parameterCount})`);
  }

  if (ast.functions.length > 20) {
    score -= 5;
    issues.push(`Many functions in one file (${ast.functions.length})`);
  }

  return { score: Math.max(0, score), issues };
}
