import { ASTResult } from './types';

export type DetectedFramework =
  | 'flask' | 'fastapi' | 'django' | 'sqlalchemy' | 'pydantic'
  | 'express' | 'nestjs' | 'nextjs' | 'react' | 'vue' | 'angular'
  | 'gin' | 'echo' | 'fiber' | 'net/http'
  | 'actix' | 'rocket' | 'axum'
  | 'none';

export interface FrameworkInfo {
  name: DetectedFramework;
  language: string;
  confidence: number;
  evidence: string[];
}

export const FRAMEWORK_SIGNATURES: Record<string, { name: DetectedFramework; weight: number }[]> = {
  python: [
    { name: 'fastapi', weight: 5 },
    { name: 'flask', weight: 4 },
    { name: 'django', weight: 3 },
    { name: 'sqlalchemy', weight: 2 },
    { name: 'pydantic', weight: 1 },
  ],
  typescript: [
    { name: 'nestjs', weight: 5 },
    { name: 'nextjs', weight: 4 },
    { name: 'express', weight: 3 },
    { name: 'react', weight: 2 },
    { name: 'vue', weight: 2 },
    { name: 'angular', weight: 2 },
  ],
  javascript: [
    { name: 'express', weight: 4 },
    { name: 'nextjs', weight: 3 },
    { name: 'react', weight: 2 },
    { name: 'vue', weight: 2 },
    { name: 'angular', weight: 2 },
  ],
  go: [
    { name: 'gin', weight: 4 },
    { name: 'echo', weight: 3 },
    { name: 'fiber', weight: 3 },
    { name: 'net/http', weight: 1 },
  ],
  rust: [
    { name: 'actix', weight: 4 },
    { name: 'axum', weight: 3 },
    { name: 'rocket', weight: 2 },
  ],
};

const FRAMEWORK_IMPORT_PATTERNS: Record<DetectedFramework, RegExp[]> = {
  flask: [/from\s+flask\s+import/, /import\s+flask/, /Flask\s*\(/],
  fastapi: [/from\s+fastapi\s+import/, /import\s+fastapi/, /FastAPI\s*\(/],
  django: [/from\s+django\./, /import\s+django/, /django\.conf/],
  sqlalchemy: [/from\s+sqlalchemy/, /import\s+sqlalchemy/, /declarative_base/, /Column\s*\(/, /Session\s*\(/],
  pydantic: [/from\s+pydantic\s+import/, /import\s+pydantic/, /BaseModel/],
  express: [/require\s*\(\s*['"]express['"]\s*\)/, /from\s+['"]express['"]/, /express\s*\(\)/],
  nestjs: [/@Module\s*\(/, /@Controller\s*\(/, /@Injectable\s*\(/, /nestjs/],
  nextjs: [/next\/(router|head|image|link|server)/, /NextRequest/, /NextResponse/, /next\/server/],
  react: [/from\s+['"]react['"]/, /React\./, /useState/, /useEffect/, /JSX\.Element/],
  vue: [/from\s+['"]vue['"]/, /createApp/, /defineComponent/, /ref\s*\(/, /computed\s*\(/],
  angular: [/@Component\s*\(/, /@NgModule\s*\(/, /angular/],
  gin: [/github\.com\/gin-gonic\/gin/, /gin\.Default/, /gin\.New/, /gin\.Context/],
  echo: [/github\.com\/labstack\/echo/, /echo\.New/, /echo\.Context/],
  fiber: [/github\.com\/gofiber\/fiber/, /fiber\.New/, /fiber\.Ctx/],
  'net/http': [/net\/http/, /http\.HandleFunc/, /http\.ListenAndServe/, /http\.Handler/],
  actix: [/actix_web/, /actix-web/, /use\s+actix_web/, /App::new/, /HttpServer/],
  rocket: [/rocket::/, /#\[get/, /#\[post/, /use\s+rocket/],
  axum: [/axum::/, /use\s+axum/, /Router::new/, /Serve::.*bind/],
  none: [],
};

export function detectFramework(ast: ASTResult): FrameworkInfo {
  const language = ast.language;
  const signatures = FRAMEWORK_SIGNATURES[language] || [];
  const scores: Map<DetectedFramework, { score: number; evidence: string[] }> = new Map();

  for (const imp of ast.imports) {
    const source = imp.source || imp.name;
    for (const { name, weight } of signatures) {
      const patterns = FRAMEWORK_IMPORT_PATTERNS[name];
      for (const pattern of patterns) {
        if (pattern.test(source) || pattern.test(imp.name)) {
          const existing = scores.get(name) || { score: 0, evidence: [] };
          existing.score += weight;
          existing.evidence.push(`import: ${imp.name} from ${source}`);
          scores.set(name, existing);
        }
      }
    }
  }

  for (const route of ast.routes) {
    const existing = scores.get(route.framework as DetectedFramework) || { score: 0, evidence: [] };
    existing.score += 3;
    existing.evidence.push(`route: ${route.method} ${route.path}`);
    scores.set(route.framework as DetectedFramework, existing);
  }

  for (const { name, weight } of signatures) {
    const patterns = FRAMEWORK_IMPORT_PATTERNS[name];
    for (const call of ast.calls) {
      for (const pattern of patterns) {
        if (pattern.test(call.name)) {
          const existing = scores.get(name) || { score: 0, evidence: [] };
          existing.score += 1;
          existing.evidence.push(`call: ${call.name}()`);
          scores.set(name, existing);
        }
      }
    }
  }

  for (const fn of ast.functions) {
    for (const decorator of fn.decorators) {
      for (const { name, weight } of signatures) {
        const patterns = FRAMEWORK_IMPORT_PATTERNS[name];
        for (const pattern of patterns) {
          if (pattern.test(decorator)) {
            const existing = scores.get(name) || { score: 0, evidence: [] };
            existing.score += weight;
            existing.evidence.push(`decorator: @${decorator}`);
            scores.set(name, existing);
          }
        }
      }
    }
  }

  let best: DetectedFramework = 'none';
  let bestScore = 0;
  let bestEvidence: string[] = [];

  for (const [name, { score, evidence }] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = name;
      bestEvidence = evidence;
    }
  }

  const maxPossibleScore = 15;
  const confidence = Math.min(bestScore / maxPossibleScore, 1.0);

  return {
    name: best,
    language,
    confidence,
    evidence: bestEvidence.slice(0, 10),
  };
}

export function detectFrameworkFromImports(imports: string[], language: string): DetectedFramework {
  const signatures = FRAMEWORK_SIGNATURES[language] || [];
  const scores: Map<DetectedFramework, number> = new Map();

  for (const imp of imports) {
    for (const { name, weight } of signatures) {
      const patterns = FRAMEWORK_IMPORT_PATTERNS[name];
      for (const pattern of patterns) {
        if (pattern.test(imp)) {
          scores.set(name, (scores.get(name) || 0) + weight);
        }
      }
    }
  }

  let best: DetectedFramework = 'none';
  let bestScore = 0;
  for (const [name, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }

  return best;
}
