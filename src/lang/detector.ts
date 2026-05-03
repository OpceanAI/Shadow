import { SupportedLanguage } from '../types';
import { fileExists } from '../utils/fs';
import * as path from 'path';

export function detectLanguage(targetPath: string): SupportedLanguage {
  const ext = path.extname(targetPath).toLowerCase();

  switch (ext) {
    case '.py':
      return 'python';
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.rs':
      return 'rust';
    case '.go':
      return 'go';
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.fish':
      return 'shell';
    case '.java':
      return 'java';
    case '.kt':
    case '.kts':
      return 'kotlin';
    case '.swift':
      return 'swift';
    case '.rb':
      return 'ruby';
    case '.php':
    case '.phtml':
      return 'php';
    case '.scala':
    case '.sc':
      return 'scala';
    case '.ex':
    case '.exs':
      return 'elixir';
    case '.hs':
    case '.lhs':
      return 'haskell';
    case '.sql':
    case '.psql':
      return 'sql';
    case '.yaml':
    case '.yml':
      return 'yaml';
    case '.toml':
      return 'yaml';
    case '.tf':
    case '.tfvars':
      return 'terraform';
    case '.md':
    case '.mdx':
      return 'markdown';
    case '.c':
    case '.cc':
    case '.cpp':
    case '.cxx':
    case '.h':
    case '.hpp':
    case '.hxx':
    case '.h++':
      return 'cpp';
    default:
      break;
  }

  // Dockerfile detection (no extension)
  const basename = path.basename(targetPath).toLowerCase();
  if (basename === 'dockerfile' || basename.startsWith('dockerfile.') ||
      basename === '.dockerfile' || targetPath.toLowerCase().includes('.dockerfile')) {
    return 'dockerfile';
  }

  // Terraform/HCL detection
  if (basename.endsWith('.tf') || basename.endsWith('.hcl')) {
    return 'terraform';
  }

  // Project-level detection
  if (
    fileExists(path.join(targetPath, 'package.json')) ||
    fileExists(path.join(targetPath, 'tsconfig.json'))
  ) {
    return 'typescript';
  }
  if (fileExists(path.join(targetPath, 'pyproject.toml')) || fileExists(path.join(targetPath, 'setup.py'))) {
    return 'python';
  }
  if (fileExists(path.join(targetPath, 'Cargo.toml'))) {
    return 'rust';
  }
  if (fileExists(path.join(targetPath, 'go.mod'))) {
    return 'go';
  }
  if (fileExists(path.join(targetPath, 'pom.xml')) || fileExists(path.join(targetPath, 'build.gradle')) ||
      fileExists(path.join(targetPath, 'build.gradle.kts'))) {
    return 'java';
  }
  if (fileExists(path.join(targetPath, 'CMakeLists.txt')) || fileExists(path.join(targetPath, 'Makefile'))) {
    return 'cpp';
  }
  if (fileExists(path.join(targetPath, 'Gemfile'))) {
    return 'ruby';
  }
  if (fileExists(path.join(targetPath, 'composer.json'))) {
    return 'php';
  }
  if (fileExists(path.join(targetPath, 'mix.exs'))) {
    return 'elixir';
  }
  if (fileExists(path.join(targetPath, 'stack.yaml')) || fileExists(path.join(targetPath, 'package.yaml'))) {
    return 'haskell';
  }
  if (fileExists(path.join(targetPath, 'Package.swift'))) {
    return 'swift';
  }
  if (fileExists(path.join(targetPath, 'build.sbt'))) {
    return 'scala';
  }

  return 'unknown';
}
