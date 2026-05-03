# Supported Languages

Shadow analyzes 20+ programming languages, configuration formats, and markup languages.

## Language Support Matrix

| Language | Extensions | Imports | Functions | Classes | Env Vars | Framework Detection |
|----------|-----------|---------|-----------|---------|----------|-------------------|
| Python | `.py` | ✓ | ✓ | ✓ | ✓ | Flask, Django, FastAPI |
| TypeScript | `.ts`, `.tsx` | ✓ | ✓ | ✓ | ✓ | Express, Next.js, NestJS |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | ✓ | ✓ | ✓ | ✓ | Express, React, Vue |
| Go | `.go` | ✓ | ✓ | ✓ | ✓ | Gin, Echo, Fiber |
| Rust | `.rs` | ✓ | ✓ | ✓ | ✓ | Actix, Rocket, Axum |
| Shell | `.sh`, `.bash`, `.zsh`, `.fish` | ✓ | — | — | ✓ | — |
| Java | `.java` | ✓ | ✓ | ✓ | — | Spring, Micronaut |
| Kotlin | `.kt`, `.kts` | ✓ | ✓ | ✓ | — | Ktor, Spring |
| Scala | `.scala`, `.sc` | ✓ | ✓ | ✓ | — | Play, Akka |
| Swift | `.swift` | ✓ | ✓ | ✓ | — | Vapor |
| Ruby | `.rb` | ✓ | ✓ | ✓ | — | Rails, Sinatra |
| PHP | `.php`, `.phtml` | ✓ | ✓ | ✓ | — | Laravel, Symfony |
| Elixir | `.ex`, `.exs` | ✓ | ✓ | ✓ | — | Phoenix |
| Haskell | `.hs`, `.lhs` | ✓ | ✓ | ✓ | — | Yesod, Scotty |
| SQL | `.sql`, `.psql` | — | — | — | — | — |
| YAML | `.yaml`, `.yml`, `.toml` | — | — | — | — | — |
| Dockerfile | `Dockerfile` | — | — | — | — | — |
| Terraform | `.tf`, `.tfvars`, `.hcl` | — | — | — | — | — |
| C / C++ | `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hpp`, `.hxx` | ✓ | ✓ | ✓ | — | — |
| Markdown | `.md`, `.mdx` | — | — | — | — | — |

## Detection Logic

Shadow detects languages using a three-tier system:

### 1. Extension-based detection

The file extension is checked first (e.g., `.py` → Python, `.ts` → TypeScript).

### 2. Filename-based detection

For files without extensions, the filename is checked (e.g., `Dockerfile`, `Makefile`).

### 3. Project-level detection

When analyzing a directory, Shadow looks for project marker files:

| Project File | Detected Language |
|-------------|-------------------|
| `package.json` | TypeScript |
| `tsconfig.json` | TypeScript |
| `pyproject.toml` | Python |
| `setup.py` | Python |
| `Cargo.toml` | Rust |
| `go.mod` | Go |
| `pom.xml` | Java |
| `build.gradle` | Java |
| `CMakeLists.txt` | C / C++ |
| `Makefile` | C / C++ |
| `Gemfile` | Ruby |
| `composer.json` | PHP |
| `mix.exs` | Elixir |
| `stack.yaml` | Haskell |
| `Package.swift` | Swift |
| `build.sbt` | Scala |

## Import Extraction by Language

### Python

- `import module` — external dependency
- `from module import name` — external dependency
- `from .module import name` — internal dependency

### TypeScript / JavaScript

- `import { x } from 'module'` — external
- `import { x } from './module'` — internal
- `const x = require('module')` — external

### Go

- `import "package"` — external
- Multi-line `import (...)` blocks

### Rust

- `use crate::module` — internal
- `use external_crate::Type` — external

## Env Var Detection

Shadow detects environment variables from source code patterns:

- **Node.js/TS**: `process.env.VAR`, `process.env["VAR"]`
- **Python**: `os.environ["VAR"]`, `os.environ.get("VAR")`, `os.getenv("VAR")`
- **Go**: `os.Getenv("VAR")`
- **Rust**: `env::var("VAR")`, `env::var_os("VAR")`
- **Shell**: `${VAR}`
- **Config**: `config("VAR")`

## Adding a New Language

To add support for a new language, create a detector in `src/lang/` and add:

1. Extension mapping in `src/lang/detector.ts`
2. Import extraction regexes
3. Function/class extraction patterns
4. Env var detection patterns
