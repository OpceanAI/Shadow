export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  dim: string;
  bold: string;
  bg: string;
  text: string;
  muted: string;
  border: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  symbols: {
    success: string;
    error: string;
    warning: string;
    info: string;
    arrow: string;
    bullet: string;
    separator: string;
  };
  emoji: {
    success: string;
    error: string;
    warning: string;
    info: string;
    file: string;
    folder: string;
    link: string;
    key: string;
    lock: string;
    test: string;
    deploy: string;
    graph: string;
    ai: string;
    bug: string;
    fix: string;
  };
}

export const darkTheme: Theme = {
  name: 'dark',
  colors: {
    primary: '#89b4fa',
    secondary: '#a6e3a1',
    accent: '#cba6f7',
    success: '#a6e3a1',
    warning: '#f9e2af',
    error: '#f38ba8',
    info: '#89dceb',
    dim: '#585b70',
    bold: '#cdd6f4',
    bg: '#1e1e2e',
    text: '#cdd6f4',
    muted: '#a6adc8',
    border: '#45475a',
  },
  symbols: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    arrow: '↳',
    bullet: '•',
    separator: '─',
  },
  emoji: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    file: '📄',
    folder: '📁',
    link: '🔗',
    key: '🔑',
    lock: '🔒',
    test: '🧪',
    deploy: '🚀',
    graph: '📊',
    ai: '🤖',
    bug: '🐛',
    fix: '🔧',
  },
};

export const lightTheme: Theme = {
  name: 'light',
  colors: {
    primary: '#2563eb',
    secondary: '#16a34a',
    accent: '#7c3aed',
    success: '#16a34a',
    warning: '#ca8a04',
    error: '#dc2626',
    info: '#0891b2',
    dim: '#9ca3af',
    bold: '#111827',
    bg: '#ffffff',
    text: '#1f2937',
    muted: '#6b7280',
    border: '#d1d5db',
  },
  symbols: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    arrow: '→',
    bullet: '·',
    separator: '─',
  },
  emoji: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    file: '📄',
    folder: '📁',
    link: '🔗',
    key: '🔑',
    lock: '🔒',
    test: '🧪',
    deploy: '🚀',
    graph: '📊',
    ai: '🤖',
    bug: '🐛',
    fix: '🔧',
  },
};

export const minimalTheme: Theme = {
  name: 'minimal',
  colors: {
    primary: '#333333',
    secondary: '#555555',
    accent: '#777777',
    success: '#333333',
    warning: '#555555',
    error: '#333333',
    info: '#777777',
    dim: '#aaaaaa',
    bold: '#000000',
    bg: '#ffffff',
    text: '#222222',
    muted: '#999999',
    border: '#cccccc',
  },
  symbols: {
    success: '+',
    error: '!',
    warning: '*',
    info: 'i',
    arrow: '>',
    bullet: '-',
    separator: '-',
  },
  emoji: {
    success: '',
    error: '',
    warning: '',
    info: '',
    file: '',
    folder: '',
    link: '',
    key: '',
    lock: '',
    test: '',
    deploy: '',
    graph: '',
    ai: '',
    bug: '',
    fix: '',
  },
};

export const neonTheme: Theme = {
  name: 'neon',
  colors: {
    primary: '#00ff00',
    secondary: '#00ffff',
    accent: '#ff00ff',
    success: '#00ff00',
    warning: '#ffff00',
    error: '#ff0000',
    info: '#00ffff',
    dim: '#004400',
    bold: '#00ff00',
    bg: '#001100',
    text: '#00ff00',
    muted: '#006600',
    border: '#003300',
  },
  symbols: {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
    arrow: '↳',
    bullet: '•',
    separator: '━',
  },
  emoji: {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    file: '📄',
    folder: '📁',
    link: '🔗',
    key: '🔑',
    lock: '🔒',
    test: '🧪',
    deploy: '🚀',
    graph: '📊',
    ai: '🤖',
    bug: '🐛',
    fix: '🔧',
  },
};

export const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
  minimal: minimalTheme,
  neon: neonTheme,
};

export function getTheme(name: string): Theme {
  return themes[name] || darkTheme;
}

export interface CustomThemeConfig {
  name: string;
  palette: Partial<ThemeColors>;
  symbolOverrides?: Partial<Theme['symbols']>;
  emojiOverrides?: Partial<Theme['emoji']>;
}

export function createCustomTheme(config: CustomThemeConfig): Theme {
  const base = darkTheme;
  return {
    name: config.name,
    colors: { ...base.colors, ...config.palette },
    symbols: { ...base.symbols, ...config.symbolOverrides },
    emoji: { ...base.emoji, ...config.emojiOverrides },
  };
}

export function hexToAnsi(hex: string, isBackground: boolean = false): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const code = isBackground ? 48 : 38;
  return `\u001B[${code};2;${r};${g};${b}m`;
}

export function getColorForStatus(status: string, theme: Theme): string {
  switch (status) {
    case 'pass': case 'success': return theme.colors.success;
    case 'fail': case 'error': return theme.colors.error;
    case 'warn': case 'warning': return theme.colors.warning;
    default: return theme.colors.info;
  }
}

export function getEmojiForType(type: string, theme: Theme): string {
  const map: Record<string, keyof Theme['emoji']> = {
    file: 'file', folder: 'folder', link: 'link',
    env: 'key', secret: 'lock', test: 'test',
    deploy: 'deploy', graph: 'graph', ai: 'ai',
    bug: 'bug', fix: 'fix',
  };
  const emojiKey = map[type] || 'info';
  return theme.emoji[emojiKey] || '';
}
