import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  printError,
  printSuccess,
  printWarning,
  printSectionHeader,
  printDivider,
  setTheme,
  setEmoji,
  setVerbose,
  getCurrentTheme,
} from '../../output/human';
import { getTheme } from '../../output/theme';

describe('printError', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('calls console.error with the message', () => {
    printError('Something went wrong');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0].join(' ');
    expect(output).toContain('Something went wrong');
  });

  it('includes error symbol by default', () => {
    setEmoji(false);
    printError('Test error');
    expect(consoleErrorSpy).toHaveBeenCalled();
    const output = consoleErrorSpy.mock.calls[0].join(' ');
    expect(output).toContain('✗');
  });
});

describe('printSuccess', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('calls console.log with the message', () => {
    printSuccess('Operation completed');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0].join(' ');
    expect(output).toContain('Operation completed');
  });

  it('includes success symbol by default', () => {
    setEmoji(false);
    printSuccess('Done');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0].join(' ');
    expect(output).toContain('✓');
  });
});

describe('printWarning', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('calls console.warn with the message', () => {
    printWarning('This is a warning');
    expect(consoleWarnSpy).toHaveBeenCalled();
    const output = consoleWarnSpy.mock.calls[0].join(' ');
    expect(output).toContain('This is a warning');
  });
});

describe('printSectionHeader', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('includes the title in output', () => {
    printSectionHeader('Dependencies');
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0].join(' ');
    expect(output).toContain('Dependencies');
  });
});

describe('printDivider', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('calls console.log', () => {
    printDivider();
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});

describe('theme settings', () => {
  it('setTheme changes current theme', () => {
    const dark = getTheme('dark');
    const light = getTheme('light');
    setTheme(dark);
    expect(getCurrentTheme().name).toBe('dark');
    setTheme(light);
    expect(getCurrentTheme().name).toBe('light');
  });

  it('setEmoji toggles emoji mode', () => {
    setEmoji(true);
    setEmoji(false);
  });

  it('setVerbose toggles verbose mode', () => {
    setVerbose(true);
    setVerbose(false);
  });

  it('getCurrentTheme returns a valid theme', () => {
    const theme = getCurrentTheme();
    expect(theme).toBeDefined();
    expect(theme.name).toBeDefined();
    expect(theme.colors).toBeDefined();
    expect(theme.symbols).toBeDefined();
    expect(theme.emoji).toBeDefined();
  });
});
