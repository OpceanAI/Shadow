import { ProjectInfo, FileInfo } from '../types';

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
    _exporter_id?: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
}

export interface PostmanItem {
  name: string;
  request?: {
    method: string;
    header: PostmanHeader[];
    url: PostmanURL;
    body?: PostmanRequestBody;
    description?: string;
  };
  item?: PostmanItem[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanURL {
  raw: string;
  protocol?: string;
  host: string[];
  port?: string;
  path: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanURLVariable[];
}

export interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
}

export interface PostmanURLVariable {
  key: string;
  value: string;
  description?: string;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
  description?: string;
}

export interface PostmanRequestBody {
  mode: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql';
  raw?: string;
  options?: { raw: { language: string } };
}

export function generatePostman(project: ProjectInfo): PostmanCollection {
  const routes = extractRoutes(project);

  const items: PostmanItem[] = routes.map((route) => ({
    name: `${route.method} ${route.path}`,
    request: {
      method: route.method,
      header: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Accept', value: 'application/json' },
      ],
      url: {
        raw: `{{baseUrl}}${route.path}`,
        protocol: 'https',
        host: ['{{baseUrl}}'],
        path: route.path.split('/').filter(Boolean),
      },
      description: `Auto-generated from ${route.file}`,
    },
  }));

  const envVariables: PostmanVariable[] = project.envVars.map((v) => ({
    key: v,
    value: `{{${v}}}`,
    type: 'string',
    description: `Environment variable used in ${project.name}`,
  }));

  const baseVars: PostmanVariable[] = [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'string', description: 'Base URL for API requests' },
    ...envVariables,
  ];

  return {
    info: {
      name: project.name,
      description: project.summary,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: baseVars,
  };
}

function extractRoutes(project: ProjectInfo): { method: string; path: string; file: string }[] {
  const routes: { method: string; path: string; file: string }[] = [];

  for (const file of project.files) {
    const fileRoutes = extractRoutesFromFunctions(file);
    routes.push(...fileRoutes);
  }

  if (routes.length === 0) {
    const routeFiles = project.files.filter((f) =>
      f.path.includes('route') || f.path.includes('handler') || f.path.includes('api')
    );
    for (const f of routeFiles) {
      routes.push({
        method: 'GET',
        path: '/' + f.path.replace(/\.[^.]+$/, '').replace(/^src\//, ''),
        file: f.path,
      });
    }
  }

  return routes;
}

function extractRoutesFromFunctions(file: FileInfo): { method: string; path: string; file: string }[] {
  const routes: { method: string; path: string; file: string }[] = [];
  const methodMap: Record<string, string> = {
    get: 'GET', post: 'POST', put: 'PUT', delete: 'DELETE',
    patch: 'PATCH', head: 'HEAD', options: 'OPTIONS',
  };

  for (const fn of file.functions) {
    const lower = fn.toLowerCase();
    for (const [prefix, method] of Object.entries(methodMap)) {
      if (lower.startsWith(prefix)) {
        const pathPart = fn.slice(prefix.length).replace(/([A-Z])/g, '-$1').toLowerCase();
        routes.push({
          method,
          path: '/' + (pathPart || 'index').replace(/^-/, ''),
          file: file.path,
        });
        break;
      }
    }
  }

  return routes;
}

export function postmanToJSON(collection: PostmanCollection): string {
  return JSON.stringify(collection, null, 2);
}
