# Command Reference

Shadow provides 30+ commands for codebase analysis, tracing, testing, and improvement.

## Core Commands

### `shadow init`

Initialize Shadow in a repository. Creates `.shadow/` directory with cache, graph, trace,
and report subdirectories.

```bash
shadow init                  # Initialize in current directory
shadow init --force          # Overwrite existing .shadow/ metadata
shadow init --lang python    # Force language detection
shadow init --json           # Machine-readable output
```

### `shadow info [target]`

Inspect a file or project. Shows imports, environment variables, external API calls,
functions, classes, and purpose.

```bash
shadow info src/index.ts     # Analyze a single file
shadow info .                # Analyze current directory (project mode)
shadow info --short          # One-line summary
shadow info --json           # Structured JSON output
shadow info --deps           # Dependency-focused view
shadow info --env            # Environment-focused view
shadow info --graph          # Connection graph view
shadow info --all            # Full detail
```

Alias: `shadow i [target]`

### `shadow graph`

Generate a dependency graph of your codebase.

```bash
shadow graph                          # Console text output
shadow graph --output dot             # Graphviz DOT format
shadow graph --output json            # JSON format
shadow graph --output mermaid         # Mermaid diagram format
shadow graph --output svg             # SVG image
shadow graph --output html            # Interactive HTML
```

Alias: `shadow g`

### `shadow trace <command>`

Trace a running command, capturing filesystem access, network calls, environment
variable reads, and child process spawns.

```bash
shadow trace python app.py            # Trace a Python app
shadow trace npm test                 # Trace test runner
shadow trace --output json            # JSON output
shadow trace --domain network         # Network events only
shadow trace --timeout 30             # 30 second timeout
```

## AI-Powered Commands

### `shadow test`

Generate and run tests using AI.

```bash
shadow test                           # Test current project
shadow test --ai openai               # Use OpenAI
shadow test --ai gemini               # Use Google Gemini
shadow test --watch                   # Watch mode
shadow test --coverage                # Coverage report
```

Alias: `shadow t`

### `shadow ai <question>`

Ask an AI about your codebase.

```bash
shadow ai "What does the auth module do?"
shadow ai --provider openai "Find SQL injection risks"
```

### `shadow explain <target>`

Explain code with AI-powered analysis.

```bash
shadow explain src/auth.py
shadow explain --provider claude src/routes.ts
```

### `shadow fix [target]`

Detect and propose fixes for code issues.

```bash
shadow fix                            # Fix current project
shadow fix src/index.ts               # Fix specific file
shadow fix --ai                       # AI-assisted fix
shadow fix --dry-run                  # Preview fixes only
```

Alias: `shadow f`

## Git Integration

### `shadow commit`

Generate a commit message based on staged changes.

```bash
shadow commit                         # Suggest commit message
shadow commit --ai                    # AI-powered suggestion
shadow commit --type feat             # Force commit type
```

Alias: `shadow c`

### `shadow diff [options]`

Compare git versions and analyze behavioral changes.

```bash
shadow diff                           # Working tree vs HEAD
shadow diff --from main               # From main branch
shadow diff --from main --to feature  # Branch comparison
shadow diff --output html             # HTML diff report
```

Alias: `shadow d`

### `shadow blame [target]`

Show git blame with author annotations.

```bash
shadow blame src/index.ts
shadow blame --authors                # Group by author
```

### `shadow history`

Show commit history with analysis.

```bash
shadow history                        # Last 20 commits
shadow history --limit 50             # Last 50 commits
```

## Analysis Commands

### `shadow security`

Run security audit on the codebase.

```bash
shadow security                       # Full security scan
shadow security --secrets-only         # Only secret detection
shadow security --dependencies         # Dependency vulnerabilities
```

### `shadow perf`

Performance analysis and bottleneck detection.

```bash
shadow perf                           # Analyze current project
shadow perf src/heavy-function.ts     # Analyze specific file
```

### `shadow metrics`

Code quality and complexity metrics.

```bash
shadow metrics                        # Project metrics
shadow metrics --complexity           # Complexity analysis only
shadow metrics --churn                # Code churn analysis
```

### `shadow deps`

Dependency analysis and visualization.

```bash
shadow deps                           # List all dependencies
shadow deps --outdated                # Find outdated deps
shadow deps --tree                    # Dependency tree
```

### `shadow lint`

Lint code with language-specific rules.

```bash
shadow lint                           # Lint entire project
shadow lint src/                      # Lint directory
shadow lint --fix                     # Auto-fix issues
```

### `shadow format`

Format code according to language conventions.

```bash
shadow format                         # Format entire project
shadow format src/index.ts            # Format specific file
shadow format --check                 # Check only, don't write
```

## Project Management

### `shadow scaffold`

Scaffold a new project from templates.

```bash
shadow scaffold python-api my-project
shadow scaffold react-app my-app
shadow scaffold --list                # List available templates
```

### `shadow migrate`

Analyze migration impact.

```bash
shadow migrate                        # Migration analysis
shadow migrate --from v1 --to v2
```

### `shadow deploy`

Deploy the project.

```bash
shadow deploy                         # Deploy with defaults
shadow deploy --target docker         # Docker deployment
shadow deploy --target vercel         # Vercel deployment
```

### `shadow pack`

Package for distribution.

```bash
shadow pack                           # Create distributable package
shadow pack --format zip              # ZIP format
shadow pack --format tar.gz           # Tarball format
```

## Developer Experience

### `shadow watch`

Watch for file changes and re-analyze.

```bash
shadow watch                          # Watch current directory
shadow watch src/                     # Watch specific directory
```

### `shadow repl`

Interactive REPL for codebase exploration.

```bash
shadow repl                           # Start REPL session
```

### `shadow tutorial`

Interactive tutorial for learning Shadow.

```bash
shadow tutorial                       # Start tutorial
shadow tutorial --reset               # Reset progress
```

### `shadow completion [shell]`

Generate shell completion scripts.

```bash
shadow completion bash                # Bash completion
shadow completion zsh                 # Zsh completion
shadow completion fish                # Fish completion
```

## Collaboration

### `shadow review`

Code review automation.

```bash
shadow review                         # Review current changes
shadow review --file src/index.ts     # Review specific file
```

### `shadow pr`

Pull request helpers.

```bash
shadow pr                             # Create PR summary
shadow pr --draft                     # Draft PR
```

### `shadow issue`

Issue creation and management.

```bash
shadow issue                          # Create issue from context
shadow issue --template bug           # Bug report template
```

### `shadow compare`

Compare two projects or branches.

```bash
shadow compare project-a project-b
```

### `shadow timeline`

Timeline of codebase changes.

```bash
shadow timeline                       # Full timeline
shadow timeline --since "2024-01-01"  # Since date
```

### `shadow contributors`

Contributor statistics.

```bash
shadow contributors                   # All contributors
shadow contributors --top 10          # Top 10 contributors
```

## Output Formats

### `shadow export`

Export analysis results in various formats.

```bash
shadow export                         # Default format
shadow export --format json           # JSON output
shadow export --format markdown       # Markdown report
shadow export --format html           # HTML report
```

## Service Commands

### `shadow server`

Start a local API server.

```bash
shadow server                         # Start on default port
shadow server --port 3456             # Custom port
```

### `shadow mcp`

Start Model Context Protocol server.

```bash
shadow mcp                            # Start MCP server
shadow mcp --port 3457                # Custom port
```

### `shadow doc`

Generate documentation.

```bash
shadow doc                            # Generate docs
shadow doc --format markdown          # Markdown format
shadow doc --format openapi           # OpenAPI spec
```

### `shadow inspect`

Inspect a function or class in detail.

```bash
shadow inspect src/auth.py::login
shadow inspect src/models.ts::User
```

### `shadow search`

Search codebase with advanced queries.

```bash
shadow search "TODO"                  # Find TODO comments
shadow search --regex "fetch"         # Regex search
shadow search --files "*.ts" "export" # Filter by file type
```
