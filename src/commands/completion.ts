import { Command } from 'commander';
import { printSectionHeader } from '../output/human';

function generateBashCompletion(programName: string): string {
  return `# ${programName} completion for bash

_${programName}_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="init info graph trace test ai fix commit diff deploy watch explain inspect export history search review doc metrics security perf deps lint format blame compare timeline contributors pr issue scaffold migrate pack mcp server repl tutorial completion"

  case $prev in
    ${programName})
      COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      ;;
    --ai|--provider|--output|--theme|--lang|--format|--target)
      COMPREPLY=()
      ;;
    completion)
      COMPREPLY=($(compgen -W "bash zsh fish" -- "$cur"))
      ;;
    watch|format|lint|test|deps)
      COMPREPLY=($(compgen -f -- "$cur"))
      ;;
    *)
      if [[ "$cur" == -* ]]; then
        local opts="--help --version --json --short --force --ai --provider --output --theme --lang --format --from --to --watch --coverage --deps --env --graph --all --dry-run --secrets-only --reset --draft --template --top --since --check --fix --outdated --complexity --churn --limit --verbose"
        COMPREPLY=($(compgen -W "$opts" -- "$cur"))
      fi
      ;;
  esac
}

complete -F _${programName}_completion ${programName}
`;
}

function generateZshCompletion(programName: string): string {
  return `#compdef ${programName}

_${programName}() {
  local -a commands
  commands=(
    'init:Initialize Shadow in a repository'
    'info:Inspect a file or project'
    'graph:Generate a dependency graph'
    'trace:Trace a running command'
    'test:Generate and run tests'
    'ai:Ask an AI about the codebase'
    'fix:Detect and fix bugs'
    'commit:Get a commit message suggestion'
    'diff:Compare git versions'
    'deploy:Deploy the project'
    'watch:Watch for changes and re-analyze'
    'explain:Explain code with AI'
    'inspect:Inspect a function or class'
    'export:Export analysis results'
    'history:Show commit history'
    'search:Search codebase'
    'review:Code review'
    'doc:Generate documentation'
    'metrics:Code metrics and quality'
    'security:Security audit'
    'perf:Performance analysis'
    'deps:Dependency analysis'
    'lint:Lint code'
    'format:Format code'
    'blame:Show git blame'
    'compare:Compare projects'
    'timeline:Timeline of changes'
    'contributors:Contributor statistics'
    'pr:Pull request helpers'
    'issue:Issue creation and management'
    'scaffold:Scaffold a new project'
    'migrate:Migration analysis'
    'pack:Package for distribution'
    'mcp:Model Context Protocol server'
    'server:Start API server'
    'repl:Interactive REPL'
    'tutorial:Interactive tutorial'
    'completion:Generate shell completion'
  )

  _arguments -C \\
    '1: :->cmds' \\
    '*:: :->args'

  case "$state" in
    cmds)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        completion)
          _values 'shell' bash zsh fish
          ;;
        info|inspect|explain|test|deps|search)
          _files
          ;;
        *)
          _files
          ;;
      esac
      ;;
  esac
}

_${programName}
`;
}

function generateFishCompletion(programName: string): string {
  return `# ${programName} completion for fish

function __fish_${programName}_commands
  echo -e "init\\tInitialize Shadow in a repository"
  echo -e "info\\tInspect a file or project"
  echo -e "graph\\tGenerate a dependency graph"
  echo -e "trace\\tTrace a running command"
  echo -e "test\\tGenerate and run tests"
  echo -e "ai\\tAsk an AI about the codebase"
  echo -e "fix\\tDetect and fix bugs"
  echo -e "commit\\tGet a commit message suggestion"
  echo -e "diff\\tCompare git versions"
  echo -e "deploy\\tDeploy the project"
  echo -e "watch\\tWatch for changes and re-analyze"
  echo -e "explain\\tExplain code with AI"
  echo -e "inspect\\tInspect a function or class"
  echo -e "export\\tExport analysis results"
  echo -e "history\\tShow commit history"
  echo -e "search\\tSearch codebase"
  echo -e "review\\tCode review"
  echo -e "doc\\tGenerate documentation"
  echo -e "metrics\\tCode metrics and quality"
  echo -e "security\\tSecurity audit"
  echo -e "perf\\tPerformance analysis"
  echo -e "deps\\tDependency analysis"
  echo -e "lint\\tLint code"
  echo -e "format\\tFormat code"
  echo -e "blame\\tShow git blame"
  echo -e "compare\\tCompare projects"
  echo -e "timeline\\tTimeline of changes"
  echo -e "contributors\\tContributor statistics"
  echo -e "pr\\tPull request helpers"
  echo -e "issue\\tIssue creation and management"
  echo -e "scaffold\\tScaffold a new project"
  echo -e "migrate\\tMigration analysis"
  echo -e "pack\\tPackage for distribution"
  echo -e "mcp\\tModel Context Protocol server"
  echo -e "server\\tStart API server"
  echo -e "repl\\tInteractive REPL"
  echo -e "tutorial\\tInteractive tutorial"
  echo -e "completion\\tGenerate shell completion"
end

complete -c ${programName} -f
complete -c ${programName} -n 'not __fish_seen_subcommand_from init info graph trace test ai fix commit diff deploy watch explain inspect export history search review doc metrics security perf deps lint format blame compare timeline contributors pr issue scaffold migrate pack mcp server repl tutorial completion' -a '(__fish_${programName}_commands)'

# Subcommand completions
complete -c ${programName} -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'
complete -c ${programName} -n '__fish_seen_subcommand_from info explain inspect' -r -F

# Options
complete -c ${programName} -l help -d 'Display help'
complete -c ${programName} -l version -d 'Display version'
complete -c ${programName} -l json -d 'JSON output'
complete -c ${programName} -l short -d 'Short output'
complete -c ${programName} -l force -d 'Force operation'
complete -c ${programName} -l ai -d 'Use AI provider'
complete -c ${programName} -l provider -d 'AI provider' -x
complete -c ${programName} -l output -d 'Output format' -x
complete -c ${programName} -l theme -d 'Color theme' -x
complete -c ${programName} -l lang -d 'Language' -x
complete -c ${programName} -l format -d 'Export format' -x
`;
}

export function completionCommand(program: Command): void {
  program
    .command('completion [shell]')
    .description('Generate shell completion script')
    .action((shell: string) => {
      const programName = 'shadow';

      switch (shell) {
        case 'bash':
          console.log(generateBashCompletion(programName));
          break;
        case 'zsh':
          console.log(generateZshCompletion(programName));
          break;
        case 'fish':
          console.log(generateFishCompletion(programName));
          break;
        default:
          printSectionHeader('Shell Completion');
          console.log('Generate shell completion with:');
          console.log(`  shadow completion bash  — Bash completion`);
          console.log(`  shadow completion zsh   — Zsh completion`);
          console.log(`  shadow completion fish  — Fish completion`);
          console.log('');
          console.log('Installation examples:');
          console.log('');
          console.log('  Bash:');
          console.log(`    echo 'source <(shadow completion bash)' >> ~/.bashrc`);
          console.log('');
          console.log('  Zsh:');
          console.log(`    echo 'source <(shadow completion zsh)' >> ~/.zshrc`);
          console.log('');
          console.log('  Fish:');
          console.log(`    shadow completion fish > ~/.config/fish/completions/shadow.fish`);
      }
    });
}
