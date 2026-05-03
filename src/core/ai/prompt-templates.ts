export type AITask =
  | 'explain'
  | 'summarize'
  | 'fix'
  | 'test'
  | 'review'
  | 'chat'
  | 'refactor'
  | 'document';

export interface PromptTemplate {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
}

const BASE_SYSTEM = `You are Shadow, an expert code analysis AI assistant. You help developers understand, trace, test, and improve code. Be concise, accurate, and practical. Always show code snippets when suggesting changes.`;

const CODE_EXPLAIN = `${BASE_SYSTEM}

You analyze source code and explain:
1. What the code does at a high level
2. The key functions, classes, and data flow
3. Any potential bugs, edge cases, or security issues
4. Suggestions for improvement

Format your response as:
## Summary
[2-3 sentence summary]

## Key Components
- **component_name**: description

## Potential Issues
- issue description (if any)

## Suggestions
- improvement suggestion (if any)`;

const CODE_FIX = `${BASE_SYSTEM}

You fix code issues and suggest improvements. For each issue:
1. Describe the problem
2. Show the fix as a unified diff (use \`\`\`diff blocks)
3. Rate the risk: low, medium, or high
4. Explain why the fix works`;

const TEST_GEN = `${BASE_SYSTEM}

You generate comprehensive tests for code. Generate:
1. Unit tests for all public functions
2. Edge case tests
3. Error handling tests
4. Integration-style tests where appropriate

Use the testing framework common for the language:
- Python: pytest with fixtures
- TypeScript/JavaScript: Jest or Vitest with describe/it
- Go: standard testing package
- Rust: standard test module`;

const CODE_REVIEW = `${BASE_SYSTEM}

You review code diffs and provide feedback:
1. Overall assessment
2. Code quality issues (naming, structure, complexity)
3. Potential bugs or edge cases
4. Performance concerns
5. Security considerations
6. Suggestions for improvement

Format clearly with sections.`;

const CHAT_SYSTEM = `${BASE_SYSTEM}

You are in an interactive coding session. You have access to the current project context.
You can read files, understand code, and suggest changes. Be conversational but concise.
When suggesting code changes, use diff format for clarity.`;

export function getPromptTemplate(
  task: AITask,
  code: string,
  language: string,
  extraContext?: string,
): PromptTemplate {
  switch (task) {
    case 'explain':
      return {
        system: CODE_EXPLAIN,
        user: `Explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n${extraContext ? `\nAdditional context: ${extraContext}` : ''}`,
        temperature: 0.3,
        maxTokens: 2000,
      };

    case 'summarize':
      return {
        system: BASE_SYSTEM,
        user: `Summarize this project:\n${code}`,
        temperature: 0.3,
        maxTokens: 1000,
      };

    case 'fix':
      return {
        system: CODE_FIX,
        user: `Fix this issue in ${language} code:\n\nIssue: ${extraContext || 'General improvement'}\n\n\`\`\`${language}\n${code}\n\`\`\``,
        temperature: 0.3,
        maxTokens: 3000,
      };

    case 'test':
      return {
        system: TEST_GEN,
        user: `Generate tests for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n${extraContext ? `\nFocus on: ${extraContext}` : ''}`,
        temperature: 0.4,
        maxTokens: 4000,
      };

    case 'review':
      return {
        system: CODE_REVIEW,
        user: `Review this ${language} code diff:\n\n\`\`\`diff\n${code}\n\`\`\``,
        temperature: 0.3,
        maxTokens: 2000,
      };

    case 'chat':
      return {
        system: CHAT_SYSTEM,
        user: code,
        temperature: 0.5,
        maxTokens: 4000,
      };

    case 'refactor':
      return {
        system: `${BASE_SYSTEM}\n\nYou refactor code to improve structure, readability, and performance while preserving behavior.`,
        user: `Refactor this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n${extraContext ? `\nGoal: ${extraContext}` : ''}`,
        temperature: 0.3,
        maxTokens: 3000,
      };

    case 'document':
      return {
        system: `${BASE_SYSTEM}\n\nYou generate documentation. Be clear, concise, and use proper formatting.`,
        user: `Document this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        temperature: 0.3,
        maxTokens: 2000,
      };

    default:
      return {
        system: BASE_SYSTEM,
        user: code,
        temperature: 0.5,
        maxTokens: 2000,
      };
  }
}
