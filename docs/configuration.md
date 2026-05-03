# Configuration Guide

Shadow reads configuration from multiple locations, merging them in order of precedence.

## Configuration Files

Shadow checks for configuration in this order (last one wins for conflicts):

1. `.shadow/config.json` — Project-level config (highest priority)
2. `.shadowrc` — Project-level config (JSON format)
3. `.shadowrc.json` — Project-level config (JSON format)
4. Built-in defaults (lowest priority)

## Default Configuration

```json
{
  "aiProvider": "local",
  "outputStyle": "human",
  "cacheEnabled": true,
  "cacheDir": ".shadow/cache",
  "cacheMaxSize": 52428800,
  "parallelWorkers": 4,
  "batchSize": 100,
  "watchDebounceMs": 300,
  "maxMemoryMB": 512,
  "theme": "dark",
  "emoji": false,
  "verbose": false,
  "tracingDepth": 10,
  "privacy": {
    "maskSecrets": true,
    "noNetwork": false,
    "allowCloudAI": false
  },
  "testGeneration": {
    "fuzzCount": 100,
    "includeSecurity": true,
    "excludePaths": []
  },
  "deploymentChecks": {
    "requiredEnvVars": [],
    "buildCommand": "",
    "smokeTestCommand": ""
  },
  "ignoredPaths": [
    ".git",
    "node_modules",
    "__pycache__",
    ".venv"
  ],
  "entryPoints": []
}
```

## Configuration Options

### AI Provider

```json
{
  "aiProvider": "openai"
}
```

Valid providers: `openai`, `claude`, `gemini`, `xai`, `deepseek`, `mistral`, `groq`,
`meta`, `cohere`, `together`, `perplexity`, `fireworks`, `cerebras`, `replicate`, `local`.

### Output Style

```json
{
  "outputStyle": "human"
}
```

Valid styles: `human`, `short`, `json`, `graph`, `patch`, `md`.

### Theme

```json
{
  "theme": "dark"
}
```

Valid themes: `dark`, `light`, `minimal`, `neon`.

### Cache

```json
{
  "cacheEnabled": true,
  "cacheDir": ".shadow/cache",
  "cacheMaxSize": 52428800
}
```

- `cacheMaxSize` in bytes (default 50 MB)

### Parallel Processing

```json
{
  "parallelWorkers": 4,
  "batchSize": 100
}
```

- `parallelWorkers`: Number of concurrent analysis workers
- `batchSize`: Files per batch for analysis

### Watch Mode

```json
{
  "watchDebounceMs": 300
}
```

### Performance Limits

```json
{
  "maxMemoryMB": 512
}
```

### Tracing

```json
{
  "tracingDepth": 10
}
```

Maximum depth for call graph tracing.

### Privacy

```json
{
  "privacy": {
    "maskSecrets": true,
    "noNetwork": false,
    "allowCloudAI": false
  }
}
```

- `maskSecrets`: Redact secret values in output (default: true)
- `noNetwork`: Block all network calls during tracing
- `allowCloudAI`: Allow sending code to cloud AI providers

### Test Generation

```json
{
  "testGeneration": {
    "fuzzCount": 100,
    "includeSecurity": true,
    "excludePaths": []
  }
}
```

- `fuzzCount`: Number of fuzz test iterations
- `includeSecurity`: Generate security-focused tests
- `excludePaths`: Paths to skip during test generation

### Deployment Checks

```json
{
  "deploymentChecks": {
    "requiredEnvVars": ["DATABASE_URL", "API_KEY"],
    "buildCommand": "npm run build",
    "smokeTestCommand": "npm run test -- --smoke"
  }
}
```

### Ignored Paths

```json
{
  "ignoredPaths": [".git", "node_modules", "dist", "__pycache__", ".venv", ".env"]
}
```

### Entry Points

```json
{
  "entryPoints": ["src/index.ts", "src/main.ts"]
}
```

Explicitly define entry points for analysis. If empty, Shadow auto-detects.

## Environment Variables

Shadow uses the AI provider's API key from environment variables. No Shadow-specific
environment variables are required.

For AI features, set the appropriate API key:

| Provider | Environment Variable |
|----------|---------------------|
| OpenAI | `OPENAI_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| Google Gemini | `GOOGLE_API_KEY` |
| xAI Grok | `XAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Mistral AI | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Meta Llama | `META_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| Perplexity AI | `PERPLEXITY_API_KEY` |
| Fireworks AI | `FIREWORKS_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Replicate | `REPLICATE_API_KEY` |

## Example Configurations

### Minimal (lightweight analysis)

```json
{
  "outputStyle": "short",
  "cacheEnabled": false,
  "emoji": false,
  "verbose": false
}
```

### Full-featured development

```json
{
  "aiProvider": "openai",
  "outputStyle": "human",
  "cacheEnabled": true,
  "theme": "dark",
  "emoji": true,
  "verbose": true,
  "privacy": {
    "maskSecrets": true,
    "allowCloudAI": true
  },
  "testGeneration": {
    "fuzzCount": 200,
    "includeSecurity": true,
    "excludePaths": ["node_modules", "dist"]
  }
}
```

### CI/CD pipeline

```json
{
  "outputStyle": "json",
  "cacheEnabled": false,
  "emoji": false,
  "parallelWorkers": 1,
  "privacy": {
    "maskSecrets": true,
    "noNetwork": true,
    "allowCloudAI": false
  }
}
```
