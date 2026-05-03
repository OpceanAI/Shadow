export function parseSQLTables(code: string): string[] {
  const tables: string[] = [];
  const createRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:['"]?(\w+)['"]?\.)?['"]?(\w+)['"]?/gi;
  let match;
  while ((match = createRegex.exec(code)) !== null) {
    tables.push(match[2] || match[1]);
  }
  return tables;
}

export function parseSQLColumns(code: string): string[] {
  const columns: string[] = [];
  const colRegex = /\b(\w+)\s+(?:INT|INTEGER|VARCHAR|TEXT|BOOLEAN|FLOAT|DOUBLE|DECIMAL|DATE|TIMESTAMP|UUID|JSON|JSONB|BLOB|BYTEA)\b/gi;
  let match;
  while ((match = colRegex.exec(code)) !== null) {
    if (!['CREATE', 'TABLE', 'ALTER', 'DROP', 'INSERT', 'UPDATE', 'DELETE', 'SELECT', 'FROM', 'WHERE', 'PRIMARY', 'FOREIGN', 'REFERENCES'].includes(match[1].toUpperCase())) {
      columns.push(match[1]);
    }
  }
  return columns;
}

export function parseSQLProcedures(code: string): string[] {
  const procs: string[] = [];
  const procRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+(\w+)/gi;
  let match;
  while ((match = procRegex.exec(code)) !== null) {
    procs.push(match[1]);
  }
  return procs;
}

export function parseSQLViews(code: string): string[] {
  const views: string[] = [];
  const viewRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)/gi;
  let match;
  while ((match = viewRegex.exec(code)) !== null) {
    views.push(match[1]);
  }
  return views;
}

export function parseSQLMigrationInfo(code: string, filePath: string): { version?: string; direction: 'up' | 'down' | 'unknown' } {
  const isDown = code.includes('DOWN') || code.includes('DROP') || filePath.includes('.down.');
  const isUp = code.includes('UP') || filePath.includes('.up.');
  const direction = isDown ? 'down' : isUp ? 'up' : 'unknown';

  const versionMatch = filePath.match(/(\d{14}|\d{4,})/);
  const version = versionMatch ? versionMatch[1] : undefined;

  return { version, direction };
}

export function detectSQLDialect(code: string): string | undefined {
  if (code.includes('CREATE EXTENSION') || code.includes('::jsonb') || code.includes('RETURNING')) {
    return 'PostgreSQL';
  }
  if (code.includes('AUTO_INCREMENT') || code.includes('ENGINE=') || code.includes('CHARSET=')) {
    return 'MySQL';
  }
  if (code.includes('NOCYCLE') || code.includes('VARCHAR2') || code.includes('PLS_INTEGER')) {
    return 'Oracle';
  }
  if (code.includes('IDENTITY') && code.includes('NVARCHAR')) {
    return 'MSSQL';
  }
  return undefined;
}
