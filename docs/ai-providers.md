# AI Provider Setup Guide

Shadow supports 15+ AI providers for code explanation, test generation, bug fixing,
and Q&A about your codebase.

## Quick Start

```bash
# Set your API key
export OPENAI_API_KEY="sk-..."

# Use it
shadow ai --provider openai "Explain the auth module"
shadow test --ai openai
```

## Supported Providers

### OpenAI

```bash
export OPENAI_API_KEY="sk-..."
shadow ai --provider openai "What does this code do?"
```

Available models: `gpt-5`, `gpt-4o`, `o3`, `gpt-4o-mini`

### Anthropic Claude

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
shadow ai --provider claude "Review this function"
```

Available models: `claude-4-opus`, `claude-4-sonnet`, `claude-3.5-haiku`

### Google Gemini

```bash
export GOOGLE_API_KEY="..."
shadow ai --provider gemini "Generate tests"
```

Available models: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`

### xAI Grok

```bash
export XAI_API_KEY="..."
shadow ai --provider xai "Find bugs"
```

Available models: `grok-4`, `grok-3`, `grok-2`

### DeepSeek

```bash
export DEEPSEEK_API_KEY="..."
shadow ai --provider deepseek "Analyze complexity"
```

Available models: `deepseek-v3`, `deepseek-r1`, `deepseek-coder`

### Mistral AI

```bash
export MISTRAL_API_KEY="..."
shadow ai --provider mistral "Explain the codebase"
```

Available models: `mistral-large`, `mistral-medium`, `mistral-small`, `codestral`

### Groq

```bash
export GROQ_API_KEY="..."
shadow ai --provider groq "Fast code review"
```

Available models: `llama-4-maverick`, `mixtral-8x7b`, `deepseek-r1-distill`

### Meta Llama

```bash
export META_API_KEY="..."
shadow ai --provider meta "Summarize changes"
```

Available models: `llama-4-maverick`, `llama-4-scout`, `llama-3.3-70b`

### Cohere

```bash
export COHERE_API_KEY="..."
shadow ai --provider cohere "Document this file"
```

Available models: `command-r-plus`, `command-r`, `command`

### Together AI

```bash
export TOGETHER_API_KEY="..."
shadow ai --provider together "Find security issues"
```

Available models: `meta-llama/Llama-4-Maverick-17B`, `deepseek-ai/DeepSeek-V3`, `Qwen/Qwen3-235B`

### Perplexity AI

```bash
export PERPLEXITY_API_KEY="..."
shadow ai --provider perplexity "Research best practices"
```

Available models: `sonar-pro`, `sonar`, `pplx-70b-online`

### Fireworks AI

```bash
export FIREWORKS_API_KEY="..."
shadow ai --provider fireworks "Generate types"
```

Available models: `llama-v3-70b`, `mixtral-8x22b`, `deepseek-v3`

### Cerebras

```bash
export CEREBRAS_API_KEY="..."
shadow ai --provider cerebras "Optimize this code"
```

Available models: `llama4-maverick-17b`, `llama3.1-70b`

### Replicate

```bash
export REPLICATE_API_KEY="..."
shadow ai --provider replicate "Run inference"
```

Available models: `meta/llama-4-maverick`, `mistralai/mistral-large`

## Local AI

Shadow supports local models through Ollama or LM Studio:

```bash
# No API key needed!
shadow ai --provider local "Explain this function"
```

Default endpoint: `http://localhost:11434` (Ollama)

## Configuring the Default Provider

Set your preferred provider in `.shadow/config.json`:

```json
{
  "aiProvider": "openai"
}
```

Or set per-command:

```bash
shadow ai --provider gemini "What does this codebase do?"
shadow test --ai claude
shadow explain --provider deepseek src/main.rs
```

## Privacy Settings

By default, Shadow does NOT send code to cloud AI providers. Enable this in your config:

```json
{
  "privacy": {
    "maskSecrets": true,
    "allowCloudAI": true
  }
}
```

When `maskSecrets` is enabled, Shadow will redact API keys, tokens, and passwords
from code before sending it to any AI provider.

When `allowCloudAI` is `false` (default), only the `local` provider can be used.
All other providers will be blocked with an error message.

## Rate Limits and Costs

Each provider has its own rate limits and pricing. Shadow does not add any overhead.
Refer to each provider's documentation for current pricing:

- [OpenAI Pricing](https://openai.com/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [Google Gemini Pricing](https://ai.google.dev/pricing)
- [Mistral Pricing](https://mistral.ai/pricing)
- etc.
