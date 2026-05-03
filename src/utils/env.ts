export function getEnvVarsFromCode(code: string): string[] {
  const envVars = new Set<string>();
  const patterns = [
    /process\.env\.(\w+)/g,
    /process\.env\[['"](\w+)['"]\]/g,
    /os\.environ\[['"](\w+)['"]\]/g,
    /os\.environ\.get\(['"](\w+)['"]/gi,
    /os\.getenv\(['"](\w+)['"]/gi,
    /os\.Getenv\(['"](\w+)['"]/g,
    /env::var\(['"](\w+)['"]/g,
    /env::var_os\(['"](\w+)['"]\)/g,
    /\$\{(\w+)\}/g,
    /config\(['"](\w+)['"],/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(code)) !== null) {
      envVars.add(match[1] || match[0]);
    }
  }

  const filtered = Array.from(envVars).filter((v) => {
    if (v.length <= 1) return false;
    return !/^(?:true|false|null|undefined|NaN|console|window|document)$/i.test(v);
  });

  return filtered;
}

export function isSecretVar(name: string): boolean {
  const secretPatterns = [
    /key/i,
    /secret/i,
    /token/i,
    /password/i,
    /passwd/i,
    /credential/i,
    /auth/i,
    /api_?key/i,
    /private/i,
  ];
  return secretPatterns.some((p) => p.test(name));
}
