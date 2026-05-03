import { ProjectInfo, FileInfo, DependencyGraph } from '../types';

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, OpenAPIPathItem>>;
  servers?: { url: string; description?: string }[];
  components?: {
    schemas?: Record<string, OpenAPISchema>;
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  };
  tags?: { name: string; description?: string }[];
}

export interface OpenAPIPathItem {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenAPIParameter[];
  requestBody?: { content: Record<string, { schema: OpenAPISchema }> };
  responses: Record<string, { description: string; content?: Record<string, { schema: OpenAPISchema }> }>;
  tags?: string[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  required?: boolean;
  schema: OpenAPISchema;
}

export interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPISchema>;
  items?: OpenAPISchema;
  required?: string[];
  enum?: string[];
  description?: string;
  example?: unknown;
  $ref?: string;
}

export interface OpenAPISecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

export function generateOpenAPI(project: ProjectInfo): OpenAPISpec {
  const spec: OpenAPISpec = {
    openapi: '3.0.3',
    info: {
      title: project.name,
      version: '0.1.0',
      description: project.summary,
    },
    paths: {},
    tags: [],
  };

  const routeFiles = project.files.filter(
    (f) =>
      f.path.includes('route') ||
      f.path.includes('handler') ||
      f.path.includes('controller') ||
      f.path.includes('endpoint') ||
      f.path.includes('api')
  );

  for (const file of routeFiles) {
    const routes = extractRoutesFromFile(file, project);
    for (const route of routes) {
      const path = normalizePath(route.path);
      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }
      spec.paths[path][route.method.toLowerCase()] = {
        summary: route.summary,
        operationId: `${file.path.replace(/\//g, '_').replace(/\.\w+$/, '')}_${route.handler}`,
        parameters: extractParameters(file),
        responses: {
          '200': { description: 'Successful response' },
          '400': { description: 'Bad request' },
          '500': { description: 'Server error' },
        },
        tags: [file.path.split('/')[0] || 'default'],
      };
    }
  }

  const envVars = project.envVars;
  if (envVars && envVars.length > 0) {
    const securitySchemes: Record<string, OpenAPISecurityScheme> = {};
    for (const env of envVars) {
      if (/key|token|secret|auth/i.test(env)) {
        securitySchemes[env] = {
          type: 'apiKey',
          name: env,
          in: 'header',
        };
      }
    }
    if (Object.keys(securitySchemes).length > 0) {
      spec.components = spec.components || {};
      spec.components.securitySchemes = securitySchemes;
    }
  }

  return spec;
}

function extractRoutesFromFile(file: FileInfo, project: ProjectInfo): { path: string; method: string; handler: string; summary: string }[] {
  const routes: { path: string; method: string; handler: string; summary: string }[] = [];

  for (const fn of file.functions) {
    const name = fn.toLowerCase();
    if (name.startsWith('get') || name.startsWith('post') || name.startsWith('put') ||
        name.startsWith('delete') || name.startsWith('patch')) {
      let method = 'get';
      if (name.startsWith('post')) method = 'post';
      else if (name.startsWith('put')) method = 'put';
      else if (name.startsWith('delete')) method = 'delete';
      else if (name.startsWith('patch')) method = 'patch';

      routes.push({
        path: '/' + name.replace(/^(get|post|put|delete|patch)/i, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, ''),
        method: method,
        handler: fn,
        summary: `${fn} handler in ${file.path}`,
      });
    }
  }

  for (const exp of file.exports) {
    if (typeof exp === 'string' && (exp.startsWith('get') || exp.startsWith('post'))) {
      let method = exp.startsWith('post') ? 'post' : 'get';
      routes.push({
        path: '/' + exp.replace(/^(get|post|put|delete|patch)/i, '').toLowerCase(),
        method,
        handler: exp,
        summary: `${exp} endpoint in ${file.path}`,
      });
    }
  }

  if (file.functions.length === 0 && file.exports.length === 0) {
    if (file.path.includes('route') || file.path.includes('api')) {
      routes.push({
        path: '/' + file.path.replace(/\.[^.]+$/, '').replace(/^src\//, '').replace(/\/route(s)?/, ''),
        method: 'get',
        handler: 'handler',
        summary: `Route defined in ${file.path}`,
      });
    }
  }

  return routes;
}

function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

function extractParameters(file: FileInfo): OpenAPIParameter[] {
  const params: OpenAPIParameter[] = [];
  const idPatterns = [/\bid\b/, /\buuid\b/, /\bslug\b/];
  for (const fn of file.functions) {
    for (const pattern of idPatterns) {
      if (pattern.test(fn)) {
        params.push({ name: 'id', in: 'path', required: true, schema: { type: 'string' } });
        break;
      }
    }
  }
  return params;
}

export function openapiToJSON(spec: OpenAPISpec): string {
  return JSON.stringify(spec, null, 2);
}

export function openapiToYAML(spec: OpenAPISpec): string {
  const lines: string[] = [];
  function render(obj: unknown, indent: number = 0): void {
    const pad = '  '.repeat(indent);
    if (obj === null || obj === undefined) {
      lines.push(pad + 'null');
    } else if (typeof obj === 'string') {
      const escaped = obj.includes(':') || obj.includes('#') || obj.includes('{') || obj.includes('[')
        ? JSON.stringify(obj) : obj;
      lines.push(pad + escaped);
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
      lines.push(pad + String(obj));
    } else if (Array.isArray(obj)) {
      if (obj.length === 0) {
        lines.push(pad + '[]');
      } else if (obj.every((item) => typeof item !== 'object' || item === null)) {
        lines.push(pad + '- ' + obj.join('\n' + pad + '- '));
      } else {
        for (const item of obj) {
          lines.push(pad + '-');
          render(item, indent + 1);
        }
      }
    } else if (typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>);
      for (const key of keys) {
        const value = (obj as Record<string, unknown>)[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
          lines.push(pad + key + ':');
          render(value, indent + 1);
        } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          lines.push(pad + key + ':');
          render(value, indent + 1);
        } else {
          lines.push(pad + key + ':');
          render(value, indent + 1);
        }
      }
    }
  }

  render(spec);
  return lines.join('\n');
}

export function extractRoutesFromAST(astResult: unknown, filePath: string): ASTRoute[] {
  const routes: ASTRoute[] = [];
  if (!astResult || typeof astResult !== 'object') return routes;

  const ast = astResult as Record<string, unknown>;

  if (Array.isArray(ast.routes)) {
    for (const r of ast.routes as ASTRoute[]) {
      routes.push({ ...r, file: filePath });
    }
  }

  if (Array.isArray(ast.calls)) {
    for (const call of ast.calls as { name: string; callee: string; args: number }[]) {
      const methodPatterns = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
      for (const method of methodPatterns) {
        if (call.callee?.toLowerCase().includes(method) || call.name?.toLowerCase().includes(method)) {
          routes.push({
            path: '/' + (call.name || 'unknown').toLowerCase(),
            method: method.toUpperCase(),
            handler: call.name || 'handler',
            framework: 'express',
            file: filePath,
            line: 0,
          });
          break;
        }
      }
    }
  }

  return routes;
}

export interface ASTRoute {
  path: string;
  method: string;
  handler: string;
  framework: string;
  file: string;
  line: number;
}
