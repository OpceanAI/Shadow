export function maskSecret(key: string, value: string | undefined): string {
  if (!value) return '<not set>';
  if (value.length <= 4) return '****';
  const visible = Math.min(4, Math.floor(value.length / 4));
  return value.slice(0, visible) + '*'.repeat(value.length - visible);
}

export function sanitizePath(filePath: string, root: string): string {
  return filePath.replace(root, '').replace(/^\//, '');
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function safeStringify(obj: unknown): string {
  try {
    const result = JSON.stringify(obj, null, 2);
    if (result === undefined || result === null) {
      return String(obj);
    }
    return result;
  } catch {
    return String(obj);
  }
}
