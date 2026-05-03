# Plugin Development Guide

Shadow supports plugins via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).
Plugins can extend Shadow with custom analyzers, formatters, and integrations.

## Creating a Plugin

### Project Structure

```
my-shadow-plugin/
  package.json
  src/
    index.ts         # Plugin entry point
    analyzer.ts      # Custom analyzer (optional)
    formatter.ts     # Custom output formatter (optional)
```

### package.json

```json
{
  "name": "shadow-plugin-example",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "zod": "^3.0.0"
  },
  "shadow": {
    "mcp": true
  }
}
```

The `"shadow": { "mcp": true }` flag tells Shadow this package is a plugin.

## Plugin API

### Analyzer Plugin

Extend the default analyzer with custom rules:

```typescript
// src/analyzer.ts
import type { FileInfo, SupportedLanguage } from 'shadow';

export interface CustomAnalyzer {
  name: string;
  languages: SupportedLanguage[];
  analyze(code: string, lang: SupportedLanguage, path: string): Partial<FileInfo>;
}
```

### Formatter Plugin

Add custom output formats:

```typescript
// src/formatter.ts
import type { ProjectInfo, OutputFormat } from 'shadow';

export interface CustomFormatter {
  name: string;
  format: OutputFormat;
  render(info: ProjectInfo): string;
}
```

### MCP Integration

Plugins communicate with Shadow using MCP tools:

```typescript
// MCP tool definition
{
  name: "analyze_custom",
  description: "Run custom analysis on the codebase",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to analyze" }
    }
  }
}
```

## Installing Plugins

```bash
# Install from npm
npm install --save-dev shadow-plugin-example

# Or link a local plugin
npm link ./my-local-plugin

# Enable in .shadow/config.json
{
  "plugins": ["shadow-plugin-example"]
}
```

## Plugin Configuration

Plugins can define their own configuration in `.shadow/config.json`:

```json
{
  "plugins": ["shadow-plugin-security"],
  "pluginConfig": {
    "shadow-plugin-security": {
      "severity": "high",
      "rules": ["sql-injection", "xss", "path-traversal"]
    }
  }
}
```

## Publishing a Plugin

1. Ensure your `package.json` has the `"shadow": { "mcp": true }` flag
2. Publish to npm:
   ```bash
   npm publish
   ```
3. Add the `shadow-plugin` keyword to your npm package
4. (Optional) Submit a PR to add your plugin to the Shadow ecosystem list

## Example: Custom Lint Plugin

```typescript
// Full example of a simple lint plugin
import { createPlugin, FileInfo } from 'shadow';

export default createPlugin({
  name: 'custom-lint',
  version: '1.0.0',

  async analyze(code: string, path: string, language: string) {
    const issues: string[] = [];

    if (code.includes('TODO')) {
      issues.push(`TODO found in ${path}`);
    }

    if (code.includes('console.log')) {
      issues.push(`console.log found in ${path}`);
    }

    return { issues };
  },

  async format(result: any) {
    return JSON.stringify(result, null, 2);
  }
});
```
