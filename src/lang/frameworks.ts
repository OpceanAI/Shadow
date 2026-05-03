export interface FrameworkInfo {
  name: string;
  language: string;
  type: 'web' | 'api' | 'fullstack' | 'mobile' | 'cli' | 'library';
  keyImports: string[];
  configFiles: string[];
  conventions: string[];
  versionHint?: string;
}

export const FRAMEWORKS: FrameworkInfo[] = [
  // Python
  {
    name: 'Django', language: 'python', type: 'fullstack',
    keyImports: ['django', 'django.http', 'django.db', 'django.urls'],
    configFiles: ['settings.py', 'urls.py', 'wsgi.py', 'manage.py', 'asgi.py'],
    conventions: ['apps.py per app', 'models.py', 'views.py', 'admin.py', 'migrations/'],
  },
  {
    name: 'Flask', language: 'python', type: 'web',
    keyImports: ['flask', 'Flask', 'flask_cors'],
    configFiles: ['app.py', 'wsgi.py'],
    conventions: ['templates/', 'static/', 'routes/'],
  },
  {
    name: 'FastAPI', language: 'python', type: 'api',
    keyImports: ['fastapi', 'FastAPI', 'fastapi.responses'],
    configFiles: ['main.py'],
    conventions: ['routers/', 'schemas/', 'dependencies/'],
  },

  // TypeScript / JavaScript
  {
    name: 'Express', language: 'typescript', type: 'web',
    keyImports: ['express', 'express.Router'],
    configFiles: ['app.ts', 'app.js', 'server.ts', 'server.js'],
    conventions: ['routes/', 'middleware/', 'controllers/'],
  },
  {
    name: 'NestJS', language: 'typescript', type: 'fullstack',
    keyImports: ['@nestjs/common', '@nestjs/core', '@nestjs/platform-express'],
    configFiles: ['main.ts', 'app.module.ts'],
    conventions: ['*.module.ts', '*.controller.ts', '*.service.ts', '*.guard.ts', '*.decorator.ts'],
  },
  {
    name: 'Next.js', language: 'typescript', type: 'fullstack',
    keyImports: ['next', 'next/router', 'next/link', 'next/image'],
    configFiles: ['next.config.js', 'next.config.ts', 'pages/_app.tsx', 'app/layout.tsx'],
    conventions: ['pages/', 'app/', 'public/', 'api/'],
  },
  {
    name: 'React', language: 'typescript', type: 'web',
    keyImports: ['react', 'react-dom', 'react/jsx-runtime'],
    configFiles: ['vite.config.ts', 'webpack.config.js', 'package.json'],
    conventions: ['src/components/', 'src/hooks/', 'src/pages/'],
  },
  {
    name: 'Vue.js', language: 'typescript', type: 'web',
    keyImports: ['vue', 'vue-router', 'pinia'],
    configFiles: ['vue.config.js', 'vite.config.ts'],
    conventions: ['src/components/', 'src/views/', 'src/stores/'],
  },
  {
    name: 'Angular', language: 'typescript', type: 'fullstack',
    keyImports: ['@angular/core', '@angular/common', '@angular/router'],
    configFiles: ['angular.json', 'tsconfig.app.json'],
    conventions: ['*.component.ts', '*.service.ts', '*.module.ts', '*.directive.ts'],
  },

  // Java
  {
    name: 'Spring Boot', language: 'java', type: 'fullstack',
    keyImports: ['org.springframework.boot', 'org.springframework.web.bind.annotation', '@SpringBootApplication'],
    configFiles: ['pom.xml', 'build.gradle', 'application.properties', 'application.yml'],
    conventions: ['src/main/java/', 'src/main/resources/', '*Application.java', '*Controller.java'],
  },

  // Ruby
  {
    name: 'Ruby on Rails', language: 'ruby', type: 'fullstack',
    keyImports: ['rails', 'active_record', 'action_controller'],
    configFiles: ['Gemfile', 'config/routes.rb', 'config/application.rb'],
    conventions: ['app/controllers/', 'app/models/', 'app/views/', 'db/migrate/', 'config/'],
  },

  // PHP
  {
    name: 'Laravel', language: 'php', type: 'fullstack',
    keyImports: ['Illuminate', 'App\\'],
    configFiles: ['artisan', 'composer.json', 'routes/web.php', 'routes/api.php'],
    conventions: ['app/Http/Controllers/', 'app/Models/', 'resources/views/', 'database/migrations/'],
  },

  // Go
  {
    name: 'Gin', language: 'go', type: 'api',
    keyImports: ['github.com/gin-gonic/gin', 'gin.'],
    configFiles: ['main.go'],
    conventions: ['handlers/', 'middleware/', 'models/', 'routes/'],
  },

  // Rust
  {
    name: 'Actix Web', language: 'rust', type: 'web',
    keyImports: ['actix_web', 'actix_web::web', 'actix_web::App'],
    configFiles: ['Cargo.toml'],
    conventions: ['src/main.rs', 'src/handlers/', 'src/models/'],
  },

  // Kotlin
  {
    name: 'Ktor', language: 'kotlin', type: 'api',
    keyImports: ['io.ktor', 'ktor.'],
    configFiles: ['Application.kt', 'application.conf'],
    conventions: ['plugins/', 'routes/', 'models/'],
  },
];

export function detectFramework(imports: string[], filePath: string, language: string): FrameworkInfo | undefined {
  const candidates = FRAMEWORKS.filter((fw) => fw.language === language);

  for (const fw of candidates) {
    const hasKeyImport = imports.some((imp) =>
      fw.keyImports.some((ki) => imp.includes(ki) || imp === ki)
    );
    const hasConfigFile = fw.configFiles.some((cf) =>
      filePath.endsWith(cf) || filePath.includes(cf)
    );
    const matchesConvention = fw.conventions.some((conv) =>
      filePath.includes(conv)
    );

    if (hasKeyImport || hasConfigFile || matchesConvention) {
      return fw;
    }
  }

  return undefined;
}

export function detectAllFrameworks(
  files: { path: string; language: string; imports: { name: string }[] }[]
): Map<string, FrameworkInfo> {
  const detected = new Map<string, FrameworkInfo>();

  for (const file of files) {
    const fw = detectFramework(
      file.imports.map((i) => i.name),
      file.path,
      file.language
    );
    if (fw && !detected.has(fw.name)) {
      detected.set(fw.name, fw);
    }
  }

  return detected;
}

export function getFrameworkByLanguage(language: string): FrameworkInfo[] {
  return FRAMEWORKS.filter((fw) => fw.language === language);
}
