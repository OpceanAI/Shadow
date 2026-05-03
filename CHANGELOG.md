# Changelog

All notable changes to Shadow CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-01-15

### Added

- Initial release of Shadow CLI
- Multi-language codebase analysis (Python, TypeScript, JavaScript, Go, Rust, Shell, and 16 more)
- Dependency graph generation with DOT and text output
- Git integration: commit message generation, diff analysis, blame, history
- AI-powered code explanation and test generation (OpenAI, Claude, Gemini, Grok, and more)
- Code tracing with syscall interception (network, filesystem, env, process)
- Security scanning and secret detection
- Performance profiling and metrics collection
- Watch mode for continuous analysis during development
- Interactive REPL for live code exploration
- Shell completion scripts (bash, zsh, fish)
- JSON, Markdown, HTML, SVG, and Mermaid output formats
- Plugin system via MCP (Model Context Protocol)
- Project scaffolding for multiple frameworks
- Migration analysis and package management
- Comprehensive test suite with vitest
- Full documentation: README, contributing guide, command reference, AI provider setup
- MIT License

### Supported Languages

- Python
- TypeScript / JavaScript (JSX/TSX)
- Go
- Rust
- Shell (bash, zsh, fish)
- Java, Kotlin, Scala
- Swift, Ruby, PHP
- Elixir, Haskell
- SQL, YAML, Dockerfile
- Terraform / HCL
- C / C++
- Markdown

### Supported AI Providers

- OpenAI (GPT-4o, GPT-4o-mini, o3, GPT-5)
- Anthropic Claude (Opus, Sonnet, Haiku)
- Google Gemini
- xAI Grok
- DeepSeek (V3, R1, Coder)
- Mistral AI
- Groq
- Meta Llama
- Cohere
- Together AI
- Perplexity AI
- Fireworks AI
- Cerebras
- Replicate
- Local (Ollama / LM Studio)
