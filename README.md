<p align="center">
  <img src="https://img.shields.io/badge/Shadow-v1.0.0-6366F1?style=for-the-badge&labelColor=0A0A0A" alt="Shadow v1.0.0">
  <img src="https://img.shields.io/badge/License-MIT-6366F1?style=for-the-badge&labelColor=0A0A0A" alt="License">
  <img src="https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&labelColor=0A0A0A&logo=typescript&logoColor=3178C6" alt="TypeScript">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&labelColor=0A0A0A&logo=nodedotjs&logoColor=339933" alt="Node.js">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&labelColor=0A0A0A&logo=python&logoColor=3776AB" alt="Python">
  <img src="https://img.shields.io/badge/Go-1.21+-00ADD8?style=for-the-badge&labelColor=0A0A0A&logo=go&logoColor=00ADD8" alt="Go">
  <img src="https://img.shields.io/badge/Rust-1.70+-DEA584?style=for-the-badge&labelColor=0A0A0A&logo=rust&logoColor=DEA584" alt="Rust">
  <img src="https://img.shields.io/badge/Java-17+-ED8B00?style=for-the-badge&labelColor=0A0A0A&logo=openjdk&logoColor=ED8B00" alt="Java">
  <img src="https://img.shields.io/badge/C%2B%2B-17-00599C?style=for-the-badge&labelColor=0A0A0A&logo=cplusplus&logoColor=00599C" alt="C++">
</p>

---

<p align="center">
  <strong>Shadow</strong> is a local-first CLI for instant codebase intelligence. Point it at a file, folder, or running service and Shadow will tell you what the project does, how files connect, what environment variables it uses, how execution flows, what changed, and where the risky parts are.
</p>

<p align="center">
  <a href="#quickstart">Quickstart</a> &middot;
  <a href="#commands">Commands</a> &middot;
  <a href="#analysis-engine">Analysis Engine</a> &middot;
  <a href="#ai-providers">AI Providers</a> &middot;
  <a href="#supported-languages">Languages</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#plugins">Plugins</a> &middot;
  <a href="#advanced-analysis">Advanced</a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Design Principles](#design-principles)
- [Quickstart](#quickstart)
- [Commands](#commands)
- [Analysis Engine](#analysis-engine)
- [AI Providers](#ai-providers)
- [Supported Languages](#supported-languages)
- [Output Formats](#output-formats)
- [Configuration](#configuration)
- [Plugin System](#plugins)
- [Advanced Analysis](#advanced-analysis)
- [Performance](#performance)
- [CI/CD Integration](#cicd-integration)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Shadow combines static analysis, runtime tracing, test generation, AI-assisted explanation, and version-aware change understanding into a single terminal tool. It is built for the moment when you clone a repo and ask:

- What does this project do?
- Which files matter?
- What environment variables does it need?
- What calls out to the network?
- Where is the auth flow?
- What changed between version A and version B?
- What should I test before shipping?

Shadow answers those questions from the terminal, fast.

### Design Principles

| Principle | Description |
|:----------|:------------|
| **Local-first** | Analysis works without sending everything to the cloud |
| **Fast by default** | The first useful result appears quickly |
| **Explainable** | Every conclusion is easy to inspect |
| **Non-invasive** | No heavy instrumentation required |
| **Safe by default** | No secret values printed unless explicitly allowed |
| **Git-aware** | Complements Git; does not replace it |

---

## Quickstart

### Installation

```bash
# From npm (global)
npm install -g shadow

# From source
git clone https://github.com/OpceanAI/Shadow.git
cd shadow
npm install
npm run build
npm link
```

### Inspect a File

```bash
shadow info app.py
```

```
[shadow]

Imports:
  flask
  requests
  psycopg2
  dotenv

Environment:
  STRIPE_API_KEY
  SENDGRID_API_KEY
  AWS_ACCESS_KEY_ID

External calls:
  api.stripe.com
  api.sendgrid.com

Summary:
python file (4 functions, 2 classes)
```

### Inspect a Project

```bash
shadow info .
```

```
[shadow]

Imports:
  express
  axios
  pg
  crypto

Connections:
  routes.ts
  controllers.ts
  middleware.ts

Environment:
  DATABASE_URL
  OPENAI_API_KEY
  GITHUB_TOKEN

External calls:
  api.openai.com
  api.github.com

Summary:
typescript project with 40 files
```

### Trace a Running App

```bash
shadow trace python app.py
shadow trace node server.js
shadow trace --only network python app.py
```

### Generate Tests

```bash
shadow test
shadow test --fuzz
shadow test --ai openai
shadow test --coverage
```

### Compare Versions

```bash
shadow diff --from main --to feature/auth
```

### Get a Commit Suggestion

```bash
shadow commit
```

---

## Commands

Shadow is centered around a few major command families.

### shadow init

Initialize Shadow in a repository. Creates a `.shadow/` directory, detects the main language, indexes entry points, and stores cached metadata for faster future analysis.

```bash
shadow init
shadow init --force --lang python --json
```

| Flag | Description |
|:-----|:------------|
| `--force` | Overwrite existing Shadow metadata |
| `--lang <language>` | Force a language guess |
| `--json` | Machine-readable output |

### shadow info

Explain what a file or project does. This is one of Shadow's most important commands.

```bash
shadow info app.py
shadow info src/main.ts
shadow info .
shadow info . --short
shadow info . --json
shadow info . --deps
shadow info . --env
shadow info . --graph
shadow info . --all
```

| Flag | Description |
|:-----|:------------|
| `--short` | One-line summary |
| `--json` | Structured output |
| `--deps` | Dependency-focused view |
| `--env` | Environment-focused view |
| `--graph` | Connection graph |
| `--all` | Full detail |

### shadow graph

Build a dependency and flow graph for a file or project.

```bash
shadow graph
shadow graph --file app.py
shadow graph --focus auth
shadow graph --json
shadow graph --dot
shadow graph --svg
```

### shadow trace

Trace a program while it runs. Captures file reads/writes, imports loaded at runtime, environment variable access, network calls, child processes, errors, and key execution paths.

```bash
shadow trace python app.py
shadow trace node server.js
shadow trace --network --fs --env --json python app.py
```

| Flag | Description |
|:-----|:------------|
| `--network` | Trace network calls |
| `--fs` | Trace file system operations |
| `--env` | Trace environment variable access |
| `--spawn` | Trace child processes |
| `--raw` | Raw output |
| `--json` | JSON output |

### shadow test

Generate and run tests. Auto-detects Jest, Vitest, Mocha, Pytest, Cargo Test, and Go Test.

```bash
shadow test
shadow test --fuzz
shadow test --ai openai
shadow test --coverage
shadow test --security
shadow test --diff
shadow test --replay
```

| Flag | Description |
|:-----|:------------|
| `--fuzz` | Fuzz inputs |
| `--ai <provider>` | Use AI for test generation |
| `--endpoint <url>` | Test a specific endpoint |
| `--replay` | Replay previous traces |
| `--coverage` | Include coverage |
| `--security` | Security-focused checks |
| `--diff` | Compare test results between refs |

### shadow ai

Use AI to explain, summarize, or propose changes. Supports 15 AI providers.

```bash
shadow ai explain app.py
shadow ai summarize .
shadow ai suggest routes/auth.ts
shadow ai fix app.py --issue "password too long"
shadow ai providers
```

| Flag | Description |
|:-----|:------------|
| `--provider <name>` | AI provider (openai, claude, gemini, etc.) |
| `--diff` | Show diff of suggested changes |
| `--patch` | Output as patch |
| `--apply` | Apply suggested changes |
| `--dry-run` | Preview without applying |

### shadow fix

Apply or preview suggested changes. Always shows a diff before applying.

```bash
shadow fix
shadow fix --issue "login crash"
shadow fix --dry-run
```

### shadow commit

Create a semantic, meaningful commit message from actual changes.

```bash
shadow commit
```

Produces messages like `feat(auth): add password length validation` instead of `fix stuff`.

### shadow diff

Compare versions semantically. Shows what changed, which behavior changed, what files are affected, what regressions may have appeared, and which areas should be retested.

```bash
shadow diff
shadow diff --from main --to feature/login
shadow diff --model v1 --model v2
```

### shadow deploy

Validate a project before deployment. Checks missing environment variables, broken builds, obvious runtime risks, required dependencies, and basic smoke tests.

```bash
shadow deploy
shadow deploy --target docker
shadow deploy --target vercel
shadow deploy --target fly
shadow deploy --target k8s
```

### shadow watch

Watch a project and re-analyze on change.

```bash
shadow watch
shadow watch --info
shadow watch --test
```

### Additional Commands

| Command | Description |
|:--------|:------------|
| `shadow explain` | Explain a specific file, line, block, or concept |
| `shadow inspect` | Inspect sensitive or structural parts of a project |
| `shadow export` | Export findings to JSON, Markdown, DOT, HTML, OpenAPI, Postman |
| `shadow history` | View semantic commit history |
| `shadow search` | Semantic code search across the project |
| `shadow review` | AI code review of current changes |
| `shadow doc` | Generate documentation for functions, classes, or project |
| `shadow metrics` | Code quality metrics (LOC, complexity, duplication) |
| `shadow security` | SAST scanning for vulnerabilities |
| `shadow perf` | Performance bottleneck detection |
| `shadow deps` | Dependency analysis and auditing |
| `shadow lint` | Unified linter for multi-language projects |
| `shadow format` | Code formatter for multi-language projects |
| `shadow blame` | Git blame with context |
| `shadow compare` | Compare two files structurally |
| `shadow timeline` | Git timeline with semantic analysis |
| `shadow contributors` | Contribution analysis |
| `shadow pr` | Analyze a GitHub pull request |
| `shadow issue` | Analyze a GitHub issue and suggest files |
| `shadow scaffold` | Generate project boilerplate |
| `shadow migrate` | Migration assistant for framework versions |
| `shadow pack` | Pack codebase into AI-friendly format |
| `shadow mcp` | Start MCP (Model Context Protocol) server |
| `shadow server` | HTTP API mode for shadow |
| `shadow repl` | Interactive REPL mode |
| `shadow tutorial` | Interactive tutorial to learn Shadow CLI |
| `shadow completion` | Generate shell completion script |
| `shadow plugin` | Manage Shadow plugins |
| `shadow advanced` | Advanced codebase analysis and intelligence tools |

### Short Aliases

| Alias | Command |
|:------|:--------|
| `shadow i` | `shadow info` |
| `shadow g` | `shadow graph` |
| `shadow t` | `shadow test` |
| `shadow f` | `shadow fix` |
| `shadow c` | `shadow commit` |
| `shadow d` | `shadow diff` |

---

## Analysis Engine

Shadow uses a multi-layer analysis engine that combines AST parsing, regex fallback, and framework detection.

### How It Works

1. **Language Detection**: Identifies the primary language by file extension and project marker files (package.json, Cargo.toml, go.mod, pyproject.toml).

2. **AST Parsing**: Uses tree-sitter for precise syntax analysis when available. Extracts imports, functions, classes, types, decorators, and routes.

3. **Regex Fallback**: Falls back to optimized regex patterns when tree-sitter is not installed. Maintains compatibility across all environments.

4. **Framework Detection**: Automatically identifies frameworks (Flask, FastAPI, Express, NestJS, Gin, Actix, etc.) from import patterns and route definitions.

5. **Dependency Graph**: Constructs a directed graph of file relationships, external dependencies, environment variable access, and network calls.

6. **Cross-file Analysis**: Tracks function calls, type references, and data flow across file boundaries.

### Code Quality Metrics

| Metric | Description |
|:-------|:------------|
| **Cyclomatic Complexity** | Per-function branching complexity |
| **Lines of Code** | Per-file and per-module LOC counts |
| **Nesting Depth** | Maximum indentation levels |
| **Function Length** | Lines per function |
| **Parameter Count** | Arguments per function signature |
| **Dead Code** | Unused imports, uncalled functions |
| **Code Similarity** | N-gram Jaccard similarity between files |

---

## AI Providers

Shadow supports 15 AI providers with real API integration, automatic fallback, response caching, and streaming support.

### Provider Matrix

| Provider | Models | Env Variable | API Compatible |
|:---------|:-------|:-------------|:---------------|
| **OpenAI** | GPT-5, GPT-4o, o3 | `OPENAI_API_KEY` | Chat Completions |
| **Anthropic** | Claude 4 Opus, Sonnet | `ANTHROPIC_API_KEY` | Messages |
| **Google** | Gemini 2.5 Pro, Flash | `GOOGLE_API_KEY` | Generative Language |
| **xAI** | Grok 4, Grok 3 | `XAI_API_KEY` | Chat Completions |
| **DeepSeek** | V3, R1, Coder | `DEEPSEEK_API_KEY` | Chat Completions |
| **Mistral** | Large, Medium, Small | `MISTRAL_API_KEY` | Chat Completions |
| **Groq** | Llama 4, Mixtral | `GROQ_API_KEY` | Chat Completions |
| **Meta** | Llama 4 Maverick, Scout | `META_API_KEY` | Llama API |
| **Cohere** | Command R+, Command | `COHERE_API_KEY` | Chat v2 |
| **Together** | Llama 4, DeepSeek V3 | `TOGETHER_API_KEY` | Chat Completions |
| **Perplexity** | Sonar Pro, Sonar | `PERPLEXITY_API_KEY` | Chat Completions |
| **Fireworks** | Llama 70B, Mixtral | `FIREWORKS_API_KEY` | Chat Completions |
| **Cerebras** | Llama 4 Maverick | `CEREBRAS_API_KEY` | Chat Completions |
| **Replicate** | Llama 4, Mistral | `REPLICATE_API_KEY` | Predictions |
| **Local** | Ollama, LM Studio | — | Ollama API |

### Usage

```bash
# List available providers
shadow ai providers

# Use a specific provider
shadow ai explain app.py --provider gemini
shadow test --ai claude
shadow fix --issue "memory leak" --provider openai

# Set default provider in config
shadow init --config '{"aiProvider": "claude"}'
```

> [!NOTE]
> Set the appropriate environment variable for your chosen provider. The Local provider (Ollama/LM Studio) requires no API key.

### Provider Features

- **Automatic Fallback**: If a provider fails, Shadow automatically retries with the next available provider in the chain.
- **Response Caching**: AI responses are cached by input hash to reduce API costs and latency.
- **Streaming Support**: Real-time token streaming for interactive sessions.
- **Token Estimation**: Pre-call token counting to estimate cost before making API requests.
- **Rate Limiting**: Built-in rate limiting with retry logic and exponential backoff.

---

## Supported Languages

Shadow supports 15+ programming languages and configuration formats.

### Languages

| Language | Extensions | AST Parsing | Framework Detection |
|:---------|:-----------|:------------|:--------------------|
| **Python** | .py | tree-sitter-python | Flask, FastAPI, Django, SQLAlchemy |
| **TypeScript** | .ts, .tsx | tree-sitter-typescript | Express, NestJS, Next.js, React |
| **JavaScript** | .js, .jsx, .mjs | tree-sitter-javascript | Express, React, Vue |
| **Go** | .go | tree-sitter-go | Gin, Echo, Fiber |
| **Rust** | .rs | tree-sitter-rust | Actix, Rocket, Axum |
| **Java** | .java | tree-sitter-java | Spring Boot |
| **C/C++** | .c, .cpp, .h | tree-sitter-c | — |
| **Ruby** | .rb | tree-sitter-ruby | Rails, Sinatra |
| **PHP** | .php | tree-sitter-php | Laravel, Symfony |
| **Swift** | .swift | tree-sitter-swift | Vapor |
| **Kotlin** | .kt | tree-sitter-kotlin | Ktor, Spring Boot |
| **Scala** | .scala | tree-sitter-scala | Play, Akka, ZIO |
| **Elixir** | .ex, .exs | tree-sitter-elixir | Phoenix |
| **Haskell** | .hs | tree-sitter-haskell | Wai, Yesod |
| **Shell** | .sh, .bash, .zsh | tree-sitter-bash | — |

### Configuration Formats

| Format | Extensions | Analysis |
|:-------|:-----------|:---------|
| **YAML** | .yaml, .yml | Docker Compose, K8s, CI configs |
| **TOML** | .toml | Cargo, pyproject, config files |
| **Dockerfile** | Dockerfile | Multi-stage, best practices |
| **Terraform** | .tf | Resources, variables, modules |
| **SQL** | .sql | Tables, columns, migrations |
| **Markdown** | .md | Documentation quality |

---

## Output Formats

Shadow supports multiple output formats for different use cases.

| Format | Flag | Description |
|:-------|:-----|:------------|
| **Human** | default | Colored terminal output with themes |
| **Short** | `--short` | One-line summaries |
| **JSON** | `--json` | Machine-readable structured output |
| **Markdown** | `--md` | Shareable markdown reports |
| **DOT** | `--dot` | Graphviz DOT format |
| **SVG** | `--svg` | Scalable vector graphics |
| **HTML** | `--html` | Interactive HTML dashboard |
| **OpenAPI** | `--openapi` | Swagger/OpenAPI 3.0 spec |
| **Postman** | `--postman` | Postman Collection v2.1 |
| **Mermaid** | `--mermaid` | Mermaid.js diagrams |
| **PlantUML** | `--plantuml` | PlantUML diagrams |
| **CSV** | `--csv` | Tabular data export |
| **XML** | `--xml` | XML format export |

---

## Configuration

Shadow reads configuration from `.shadow/config.json` or `.shadowrc` at the project root.

### Example Configuration

```json
{
  "aiProvider": "openai",
  "outputStyle": "human",
  "cacheEnabled": true,
  "privacy": {
    "maskSecrets": true,
    "noNetwork": false,
    "allowCloudAI": false
  },
  "tracingDepth": 10,
  "testGeneration": {
    "fuzzCount": 100,
    "includeSecurity": true,
    "excludePaths": ["node_modules", ".git", "dist"]
  },
  "deploymentChecks": {
    "requiredEnvVars": ["DATABASE_URL", "API_KEY"],
    "buildCommand": "npm run build",
    "smokeTestCommand": "npm test"
  },
  "ignoredPaths": [".git", "node_modules", "__pycache__", ".venv", "dist"],
  "cacheDir": ".shadow/cache",
  "cacheMaxSize": 1000,
  "parallelWorkers": 4,
  "batchSize": 50,
  "watchDebounceMs": 300,
  "theme": "dark",
  "aliases": {
    "analyze": "info --all",
    "check": "test --coverage"
  }
}
```

### Profile-Based Configuration

```bash
# Use dev profile
SHADOW_PROFILE=dev shadow info .

# Use prod profile
SHADOW_PROFILE=prod shadow deploy
```

### YAML Configuration

```yaml
aiProvider: claude
outputStyle: human
privacy:
  maskSecrets: true
plugins:
  - sonarqube
  - codecov
profiles:
  dev:
    aiProvider: local
    outputStyle: short
  staging:
    aiProvider: openai
  prod:
    aiProvider: claude
    privacy:
      noNetwork: true
```

---

## Plugins

Shadow supports a plugin system for extending functionality.

### Installing Plugins

```bash
shadow plugin list
shadow plugin search security
shadow plugin install sonarqube
shadow plugin install codecov
shadow plugin install jira
```

### Writing a Plugin

```typescript
import { definePlugin, createAnalyzer } from '@shadow/plugin-sdk';

export default definePlugin({
  name: 'custom-linter',
  version: '1.0.0',
  description: 'Custom linting rules',

  analyzers: [
    createAnalyzer({
      languages: ['python', 'typescript'],
      analyze(code, filePath) {
        const issues = [];
        // Custom analysis logic
        return { issues };
      },
    }),
  ],
});
```

### Built-in Plugins

| Plugin | Description |
|:-------|:------------|
| **SonarQube** | Quality analysis integration |
| **Codecov** | Coverage reporting |
| **Jira** | Issue tracking integration |
| **Datadog** | Monitoring and observability |

---

## Advanced Analysis

Shadow includes 20+ advanced analysis tools for deep codebase intelligence.

### Available Tools

| Tool | Command | Description |
|:-----|:--------|:------------|
| **Knowledge Graph** | `shadow advanced knowledge-graph` | Semantic graph with JSON-LD/Neo4j export |
| **Semantic Search** | `shadow advanced semantic-search "auth flow"` | TF-IDF search with regex and fuzzy modes |
| **Code Similarity** | `shadow advanced similarities` | N-gram Jaccard duplicate detection |
| **Architecture** | `shadow advanced architecture` | MVC/microservices pattern detection, C4 model |
| **Data Flow** | `shadow advanced dataflow` | Taint tracking, sensitive data flow detection |
| **Control Flow** | `shadow advanced controlflow` | CFG per function, unreachable code detection |
| **Call Graph** | `shadow advanced callgraph` | Cross-file call graph with recursion detection |
| **Type Inference** | `shadow advanced type-inference` | JSDoc-based type inference for JavaScript |
| **API Contract** | `shadow advanced api-contract` | Route extraction, breaking change detection |
| **DB Schema** | `shadow advanced db-schema` | Prisma/TypeORM schema parsing and diff |
| **IaC Analysis** | `shadow advanced iasc` | Terraform/CloudFormation security analysis |
| **Monorepo** | `shadow advanced monorepo` | Workspace detection, cross-package impact |
| **Ownership** | `shadow advanced ownership` | Git blame aggregation, bus factor |
| **Tech Debt** | `shadow advanced debt` | Per-file scoring with refactoring suggestions |
| **Code Smells** | `shadow advanced smells` | Long method, large class, god object detection |
| **Design Patterns** | `shadow advanced patterns` | Singleton, Factory, Observer, Strategy, etc. |
| **Anti-Patterns** | `shadow advanced anti-patterns` | Spaghetti code, magic numbers, copy-paste |
| **Trends** | `shadow advanced trends` | Git history trend analysis and predictions |
| **Refactor Plan** | `shadow advanced refactor` | Step-by-step plan with risk assessment |

---

## Performance

### Analysis Speed

| Project Size | Files | Analysis Time | Memory |
|:-------------|:------|:--------------|:-------|
| Small | <100 | <1s | 50MB |
| Medium | 100-500 | 1-3s | 100MB |
| Large | 500-2000 | 3-10s | 200MB |
| Enterprise | 2000+ | 10-30s | 500MB |

### Caching

Shadow caches analysis results by file hash (SHA-256). Subsequent runs only re-analyze changed files, reducing analysis time by 80-95% for incremental changes.

### Parallel Processing

File analysis runs in configurable worker threads. Default: 4 workers. Configurable via `parallelWorkers` in config.

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Shadow Analysis
on: [pull_request]

jobs:
  shadow:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: OpceanAI/Shadow@v1
        with:
          command: info --json
          output-format: json
```

### Pre-commit Hook

```bash
#!/bin/sh
# .githooks/pre-commit
shadow info . --short
shadow lint
```

### Pre-push Hook

```bash
#!/bin/sh
# .githooks/pre-push
shadow test
shadow security
```

### Docker

```bash
docker run --rm -v $(pwd):/app shadow/cli info .
```

---

## Project Structure

```
shadow/
├── src/
│   ├── index.ts                    # CLI entry point
│   ├── types/
│   │   └── index.ts                # Type definitions and AI provider registry
│   ├── commands/                   # 38 CLI commands
│   │   ├── init.ts
│   │   ├── info.ts
│   │   ├── graph.ts
│   │   ├── trace.ts
│   │   ├── test.ts
│   │   ├── ai.ts
│   │   ├── fix.ts
│   │   ├── commit.ts
│   │   ├── diff.ts
│   │   ├── deploy.ts
│   │   ├── watch.ts
│   │   ├── explain.ts
│   │   ├── inspect.ts
│   │   ├── export.ts
│   │   ├── history.ts
│   │   ├── search.ts
│   │   ├── review.ts
│   │   ├── doc.ts
│   │   ├── metrics.ts
│   │   ├── security.ts
│   │   ├── perf.ts
│   │   ├── deps.ts
│   │   ├── lint.ts
│   │   ├── format.ts
│   │   ├── blame.ts
│   │   ├── compare.ts
│   │   ├── timeline.ts
│   │   ├── contributors.ts
│   │   ├── pr.ts
│   │   ├── issue.ts
│   │   ├── scaffold.ts
│   │   ├── migrate.ts
│   │   ├── pack.ts
│   │   ├── mcp.ts
│   │   ├── server.ts
│   │   ├── repl.ts
│   │   ├── advanced.ts
│   │   ├── tutorial.ts
│   │   ├── completion.ts
│   │   └── plugin.ts
│   ├── core/                       # Core analysis modules
│   │   ├── analyzer.ts             # Static code analysis engine
│   │   ├── ai-provider.ts          # AI provider orchestration
│   │   ├── tracer.ts               # Runtime tracing
│   │   ├── test-gen.ts             # Test generation engine
│   │   ├── fuzzer.ts               # Fuzzing engine
│   │   ├── coverage.ts             # Coverage analysis
│   │   ├── git.ts                  # Git operations
│   │   ├── graph.ts                # Dependency graph builder
│   │   ├── config/                 # Configuration management
│   │   ├── deploy/                 # Deployment validation
│   │   └── ai/                     # AI infrastructure
│   │       ├── base.ts             # Abstract provider base class
│   │       ├── http-client.ts      # Shared HTTP client with retry
│   │       ├── prompt-templates.ts # System prompts per task
│   │       ├── token-counter.ts    # Token estimation
│   │       ├── cache.ts            # AI response caching
│   │       ├── fallback.ts         # Provider fallback chains
│   │       ├── streaming.ts        # SSE streaming support
│   │       ├── chat.ts             # Interactive chat mode
│   │       └── providers/          # Provider implementations
│   ├── ast/                        # AST parsing engine
│   │   ├── engine.ts               # Main AST engine
│   │   ├── python-parser.ts
│   │   ├── typescript-parser.ts
│   │   ├── go-parser.ts
│   │   ├── rust-parser.ts
│   │   ├── regex-fallback.ts
│   │   ├── framework-detector.ts
│   │   ├── complexity.ts
│   │   ├── dead-code.ts
│   │   └── route-extractor.ts
│   ├── advanced/                   # Advanced analysis tools
│   │   ├── knowledge-graph.ts
│   │   ├── semantic-search.ts
│   │   ├── similarity.ts
│   │   ├── architecture.ts
│   │   ├── dataflow.ts
│   │   ├── control-flow.ts
│   │   ├── call-graph.ts
│   │   ├── type-inference.ts
│   │   ├── api-contract.ts
│   │   ├── db-schema.ts
│   │   ├── iasc.ts
│   │   ├── monorepo.ts
│   │   ├── ownership.ts
│   │   ├── tech-debt.ts
│   │   ├── smells.ts
│   │   ├── patterns.ts
│   │   ├── anti-patterns.ts
│   │   ├── trends.ts
│   │   └── refactor-plan.ts
│   ├── plugin/                     # Plugin system
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── loader.ts
│   │   ├── sdk.ts
│   │   └── marketplace.ts
│   ├── lang/                       # Language parsers (20+ files)
│   ├── output/                     # Output formatters (18 files)
│   ├── utils/                      # Shared utilities
│   └── __tests__/                  # Test suite (231 tests)
├── .shadow/                        # Project metadata
├── .shadowrc                       # Default configuration
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── Dockerfile
├── .github/workflows/              # CI/CD pipelines
└── docs/                           # Documentation
```

---

## Contributing

Contributions are welcome if they improve speed, clarity, safety, explainability, or usefulness in real developer workflows.

### Setup

```bash
git clone https://github.com/OpceanAI/Shadow.git
cd shadow
npm install
npm run build
npm test
```

### Guidelines

- Follow the existing code style (ESLint + TypeScript strict mode)
- Add tests for new features
- Keep the product principles in mind: local-first, fast, explainable, non-invasive, safe by default
- Write meaningful commit messages (or use `shadow commit`)

---

## License

Shadow is licensed under the [MIT License](LICENSE).

```
Copyright (c) 2024-2026 Shadow Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  <strong>Shadow</strong> — Understand, trace, test, and improve any codebase from the terminal.
</p>

<p align="center">
  Built by <a href="https://github.com/OpceanAI">OpceanAI</a>
</p>
