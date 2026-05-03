import * as fs from 'fs';
import * as path from 'path';
import { printSuccess, printWarning } from '../output/human';

interface CompletionConfig {
  shell: string;
  destination: string;
  instructions: string;
}

const COMPLETIONS: Record<string, CompletionConfig> = {
  bash: {
    shell: 'bash',
    destination: '/etc/bash_completion.d/shadow',
    instructions: 'Add to ~/.bashrc: source <(shadow completion bash)',
  },
  zsh: {
    shell: 'zsh',
    destination: '/usr/local/share/zsh/site-functions/_shadow',
    instructions: 'Add to ~/.zshrc: source <(shadow completion zsh)',
  },
  fish: {
    shell: 'fish',
    destination: '~/.config/fish/completions/shadow.fish',
    instructions: 'Run: shadow completion fish > ~/.config/fish/completions/shadow.fish',
  },
};

export class CompletionGenerator {
  private programName: string;

  constructor(programName: string = 'shadow') {
    this.programName = programName;
  }

  generateBash(): string {
    return `# ${this.programName} completion for bash

_${this.programName}_completion() {
  local cur prev words cword
  _init_completion || return

  local commands="init info graph trace test ai fix commit diff deploy watch explain inspect export history"

  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  return 0
}

complete -F _${this.programName}_completion ${this.programName}
`;
  }

  generateZsh(): string {
    return `#compdef ${this.programName}

_${this.programName}() {
  local -a commands
  commands=(
    'init:Initialize Shadow in a repository'
    'info:Inspect a file or project'
    'graph:Generate a dependency graph'
  )

  _describe 'command' commands
}

_${this.programName}
`;
  }

  generateFish(): string {
    return `# ${this.programName} completion for fish
complete -c ${this.programName} -f
complete -c ${this.programName} -a 'init info graph trace test ai fix commit'
`;
  }

  generate(shell: string): string {
    switch (shell) {
      case 'bash':
        return this.generateBash();
      case 'zsh':
        return this.generateZsh();
      case 'fish':
        return this.generateFish();
      default:
        return '';
    }
  }

  install(shell: string): boolean {
    const config = COMPLETIONS[shell];
    if (!config) return false;

    try {
      const dest = config.destination.replace(/^~/, process.env.HOME || '');
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dest, this.generate(shell), 'utf-8');
      printSuccess(`Completion installed for ${shell}: ${dest}`);
      return true;
    } catch (err) {
      printWarning(`Could not install completion: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
