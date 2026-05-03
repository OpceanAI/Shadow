# Project Architecture

Shadow CLI is a modular, multi-language codebase analysis tool built in TypeScript.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Entry (index.ts)                │
│                    Commander.js Program                   │
├─────────────────────────────────────────────────────────┤
│                     Commands Layer                       │
│  init  info  graph  trace  test  ai  fix  commit  ...   │
│  Each command registers with Commander and wires to core │
├─────────────────────────────────────────────────────────┤
│                      Core Services                       │
│  ┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐  │
│  │ Analyzer │ │ Graph  │ │  Git    │ │   Config     │  │
│  │          │ │ Builder│ │ Service │ │   Manager    │  │
│  └────┬─────┘ └───┬────┘ └────┬────┘ └──────┬───────┘  │
│       │            │          │              │          │
│  ┌────┴────────────┴──────────┴──────────────┴───────┐  │
│  │                 Language Layer                      │  │
│  │  detector  python  go  rust  ts  shell  ruby  ...  │  │
│  └────────────────────┬───────────────────────────────┘  │
│  ┌────────────────────┴───────────────────────────────┐  │
│  │                 AST Engine                          │  │
│  │  tree-sitter (primary) / regex fallback             │  │
│  └────────────────────┬───────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                     Output Layer                         │
│  human  json  markdown  html  svg  mermaid  table  ...  │
├─────────────────────────────────────────────────────────┤
│                     Utility Layer                        │
│  fs  env  sanitize  process                              │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── index.ts                  # CLI entry point, Commander setup
├── ast/                      # Abstract Syntax Tree parsing
│   ├── engine.ts             # Main AST engine (tree-sitter wrapper)
│   ├── types.ts              # AST node type definitions
│   ├── python-parser.ts      # Python AST parser
│   ├── typescript-parser.ts  # TypeScript/JS AST parser
│   ├── go-parser.ts          # Go AST parser
│   ├── rust-parser.ts        # Rust AST parser
│   ├── regex-fallback.ts     # Regex-based fallback parser
│   ├── complexity.ts         # Code complexity analysis
│   ├── dead-code.ts          # Dead code detection
│   ├── framework-detector.ts # Framework detection from AST
│   └── route-extractor.ts   # Route extraction from frameworks
├── commands/                 # CLI command implementations
│   ├── init.ts               # shadow init
│   ├── info.ts               # shadow info
│   ├── graph.ts              # shadow graph
│   ├── trace.ts              # shadow trace
│   ├── test.ts               # shadow test
│   ├── ai.ts                 # shadow ai
│   ├── ...                   # 30+ command files
│   └── tutorial.ts           # shadow tutorial
├── core/                     # Core business logic
│   ├── analyzer.ts           # Main code analyzer (ProjectInfo, FileInfo)
│   ├── graph.ts              # Dependency graph builder
│   ├── git.ts                # Git service (diff, commit, history)
│   ├── config.ts             # Configuration loading/merging
│   ├── tracer.ts             # Syscall tracing engine
│   ├── cache.ts              # File cache system
│   ├── batch.ts              # Batch processing
│   ├── parallel.ts           # Parallel worker pool
│   ├── incremental.ts        # Incremental analysis
│   ├── pool.ts               # Worker thread pool
│   ├── fuzzer.ts             # Fuzzing engine
│   ├── test-gen.ts           # Test generation
│   ├── test-regression.ts    # Regression test analysis
│   ├── test-security.ts      # Security test generation
│   ├── test-endpoint.ts      # API endpoint testing
│   ├── coverage.ts           # Code coverage analysis
│   ├── ai-provider.ts        # AI provider abstraction
│   ├── ai/                   # AI provider implementations
│   └── deploy/               # Deployment checks
├── lang/                     # Language detection and patterns
│   ├── detector.ts           # Main language detector
│   ├── frameworks.ts         # Framework detection
│   └── python.ts, go.ts, ... # Language-specific handlers
├── output/                   # Output formatting
│   ├── human.ts              # Human-readable CLI output (chalk)
│   ├── json.ts               # JSON output
│   ├── markdown.ts           # Markdown reports
│   ├── html.ts               # HTML reports
│   ├── svg.ts                # SVG graph rendering
│   ├── mermaid.ts            # Mermaid diagram output
│   ├── graph.ts              # Graph output (DOT, text)
│   ├── table.ts              # Table formatting
│   ├── patch.ts              # Patch/diff formatting
│   ├── progress.ts           # Progress bars
│   ├── pagination.ts         # Paged output
│   ├── theme.ts              # Color themes (dark, light, minimal, neon)
│   ├── openapi.ts            # OpenAPI spec generation
│   ├── postman.ts            # Postman collection export
│   └── plantuml.ts           # PlantUML diagram output
├── types/
│   └── index.ts              # All TypeScript type definitions
├── utils/
│   ├── fs.ts                 # File system utilities
│   ├── env.ts                # Environment variable detection
│   ├── sanitize.ts           # Output sanitization
│   └── process.ts            # Process execution utilities
└── __tests__/                # Test suites
    ├── utils/                # Utility tests
    ├── core/                 # Core service tests
    ├── output/               # Output formatter tests
    ├── lang/                 # Language detector tests
    ├── commands/             # Command tests
    ├── fixtures/             # Test fixture files
    └── performance/          # Performance benchmarks
```

## Design Principles

### 1. Language-Agnostic Core

The core analyzer and graph builder work with a common `FileInfo` interface.
Language-specific logic is encapsulated in the `lang/` and `ast/` modules.

### 2. Two-Tier Parsing

- **Primary**: Tree-sitter for accurate AST parsing (when available)
- **Fallback**: Regex-based extraction (always works, less precise)

### 3. Plugin-Ready

The MCP (Model Context Protocol) server allows external tools and plugins to
integrate with Shadow's analysis capabilities.

### 4. Offline-First

All analysis runs locally. AI features are opt-in and require explicit
`allowCloudAI: true` in the privacy settings.

### 5. Streaming Output

Large outputs use pagination and progress bars. The watch mode provides
real-time updates during development.

## How Analysis Works

1. **Language Detection**: Extension → filename → project markers
2. **File Discovery**: Glob patterns, skips `node_modules`, `.git`, etc.
3. **AST Parsing**: Tree-sitter or regex fallback for each file
4. **Import Extraction**: Language-specific regex/AST patterns
5. **Function/Class Extraction**: Pattern matching on AST nodes
6. **Env Var Detection**: Regex patterns for common env var access
7. **External API Detection**: URL extraction from source code
8. **Graph Construction**: Nodes (files, externals, env vars) + edges (imports, reads, network)
9. **Output Formatting**: Human, JSON, graph, etc.

## Performance Considerations

- **Incremental Analysis**: Only re-analyze changed files
- **Worker Pool**: Distribute file analysis across threads
- **Caching**: AST parse results and analysis output cached to disk
- **Batching**: Group files for efficient processing
- **Memory Limits**: Configurable max memory with graceful degradation

## Adding a New Command

1. Create `src/commands/mycommand.ts`
2. Export a function that takes the Commander `program` and registers the command
3. Wire up core services (Analyzer, GitService, etc.)
4. Use output formatters from `src/output/`
5. Register in `src/index.ts`

## Adding a New Output Format

1. Create `src/output/myformat.ts`
2. Export a `render()` function that takes `ProjectInfo` or `FileInfo`
3. Add format to `OutputFormat` type in `src/types/index.ts`
4. Wire up in relevant commands
