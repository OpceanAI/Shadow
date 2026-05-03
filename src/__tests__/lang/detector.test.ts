import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../lang/detector';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('detectLanguage', () => {
  describe('by extension', () => {
    it('detects Python by .py extension', () => {
      expect(detectLanguage('/path/to/file.py')).toBe('python');
    });

    it('detects TypeScript by .ts extension', () => {
      expect(detectLanguage('/path/to/file.ts')).toBe('typescript');
    });

    it('detects TypeScript by .tsx extension', () => {
      expect(detectLanguage('/path/to/Component.tsx')).toBe('typescript');
    });

    it('detects JavaScript by .js extension', () => {
      expect(detectLanguage('/path/to/file.js')).toBe('javascript');
    });

    it('detects JavaScript by .jsx extension', () => {
      expect(detectLanguage('/path/to/file.jsx')).toBe('javascript');
    });

    it('detects JavaScript by .mjs extension', () => {
      expect(detectLanguage('/path/to/file.mjs')).toBe('javascript');
    });

    it('detects JavaScript by .cjs extension', () => {
      expect(detectLanguage('/path/to/file.cjs')).toBe('javascript');
    });

    it('detects Rust by .rs extension', () => {
      expect(detectLanguage('/path/to/main.rs')).toBe('rust');
    });

    it('detects Go by .go extension', () => {
      expect(detectLanguage('/path/to/main.go')).toBe('go');
    });

    it('detects Shell by .sh extension', () => {
      expect(detectLanguage('/path/to/script.sh')).toBe('shell');
    });

    it('detects Shell by .bash extension', () => {
      expect(detectLanguage('/path/to/script.bash')).toBe('shell');
    });

    it('detects Shell by .zsh extension', () => {
      expect(detectLanguage('/path/to/script.zsh')).toBe('shell');
    });

    it('detects Shell by .fish extension', () => {
      expect(detectLanguage('/path/to/config.fish')).toBe('shell');
    });

    it('detects Java by .java extension', () => {
      expect(detectLanguage('/path/to/Main.java')).toBe('java');
    });

    it('detects Kotlin by .kt extension', () => {
      expect(detectLanguage('/path/to/Main.kt')).toBe('kotlin');
    });

    it('detects Kotlin by .kts extension', () => {
      expect(detectLanguage('/path/to/build.kts')).toBe('kotlin');
    });

    it('detects Swift by .swift extension', () => {
      expect(detectLanguage('/path/to/App.swift')).toBe('swift');
    });

    it('detects Ruby by .rb extension', () => {
      expect(detectLanguage('/path/to/app.rb')).toBe('ruby');
    });

    it('detects PHP by .php extension', () => {
      expect(detectLanguage('/path/to/index.php')).toBe('php');
    });

    it('detects Scala by .scala extension', () => {
      expect(detectLanguage('/path/to/Main.scala')).toBe('scala');
    });

    it('detects Elixir by .ex extension', () => {
      expect(detectLanguage('/path/to/app.ex')).toBe('elixir');
    });

    it('detects Elixir by .exs extension', () => {
      expect(detectLanguage('/path/to/config.exs')).toBe('elixir');
    });

    it('detects Haskell by .hs extension', () => {
      expect(detectLanguage('/path/to/Main.hs')).toBe('haskell');
    });

    it('detects SQL by .sql extension', () => {
      expect(detectLanguage('/path/to/schema.sql')).toBe('sql');
    });

    it('detects YAML by .yaml extension', () => {
      expect(detectLanguage('/path/to/config.yaml')).toBe('yaml');
    });

    it('detects YAML by .yml extension', () => {
      expect(detectLanguage('/path/to/config.yml')).toBe('yaml');
    });

    it('detects Terraform by .tf extension', () => {
      expect(detectLanguage('/path/to/main.tf')).toBe('terraform');
    });

    it('detects Terraform by .tfvars extension', () => {
      expect(detectLanguage('/path/to/vars.tfvars')).toBe('terraform');
    });

    it('detects Markdown by .md extension', () => {
      expect(detectLanguage('/path/to/README.md')).toBe('markdown');
    });

    it('detects C/C++ by .c extension', () => {
      expect(detectLanguage('/path/to/main.c')).toBe('cpp');
    });

    it('detects C/C++ by .cpp extension', () => {
      expect(detectLanguage('/path/to/main.cpp')).toBe('cpp');
    });

    it('detects C/C++ by .h extension', () => {
      expect(detectLanguage('/path/to/header.h')).toBe('cpp');
    });
  });

  describe('by filename (no extension)', () => {
    it('detects Dockerfile', () => {
      expect(detectLanguage('/path/to/Dockerfile')).toBe('dockerfile');
    });

    it('detects Dockerfile variants', () => {
      expect(detectLanguage('/path/to/Dockerfile.prod')).toBe('dockerfile');
      expect(detectLanguage('/path/to/.dockerfile')).toBe('dockerfile');
    });

    it('returns unknown for unknown no-extension file', () => {
      expect(detectLanguage('/path/to/unknown-file')).toBe('unknown');
    });
  });

  describe('by project files', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-detect-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('detects TypeScript project by package.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      expect(detectLanguage(tmpDir)).toBe('typescript');
    });

    it('detects Python project by pyproject.toml', () => {
      fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '');
      expect(detectLanguage(tmpDir)).toBe('python');
    });

    it('detects Python project by setup.py', () => {
      fs.writeFileSync(path.join(tmpDir, 'setup.py'), '');
      expect(detectLanguage(tmpDir)).toBe('python');
    });

    it('detects Rust project by Cargo.toml', () => {
      fs.writeFileSync(path.join(tmpDir, 'Cargo.toml'), '');
      expect(detectLanguage(tmpDir)).toBe('rust');
    });

    it('detects Go project by go.mod', () => {
      fs.writeFileSync(path.join(tmpDir, 'go.mod'), '');
      expect(detectLanguage(tmpDir)).toBe('go');
    });

    it('detects Java project by pom.xml', () => {
      fs.writeFileSync(path.join(tmpDir, 'pom.xml'), '');
      expect(detectLanguage(tmpDir)).toBe('java');
    });

    it('detects Java project by build.gradle', () => {
      fs.writeFileSync(path.join(tmpDir, 'build.gradle'), '');
      expect(detectLanguage(tmpDir)).toBe('java');
    });

    it('detects Ruby project by Gemfile', () => {
      fs.writeFileSync(path.join(tmpDir, 'Gemfile'), '');
      expect(detectLanguage(tmpDir)).toBe('ruby');
    });

    it('detects PHP project by composer.json', () => {
      fs.writeFileSync(path.join(tmpDir, 'composer.json'), '');
      expect(detectLanguage(tmpDir)).toBe('php');
    });

    it('detects Elixir project by mix.exs', () => {
      fs.writeFileSync(path.join(tmpDir, 'mix.exs'), '');
      expect(detectLanguage(tmpDir)).toBe('elixir');
    });

    it('detects Haskell project by stack.yaml', () => {
      fs.writeFileSync(path.join(tmpDir, 'stack.yaml'), '');
      expect(detectLanguage(tmpDir)).toBe('haskell');
    });

    it('detects Swift project by Package.swift', () => {
      fs.writeFileSync(path.join(tmpDir, 'Package.swift'), '');
      expect(detectLanguage(tmpDir)).toBe('swift');
    });

    it('detects C/C++ project by CMakeLists.txt', () => {
      fs.writeFileSync(path.join(tmpDir, 'CMakeLists.txt'), '');
      expect(detectLanguage(tmpDir)).toBe('cpp');
    });

    it('detects C/C++ project by Makefile', () => {
      fs.writeFileSync(path.join(tmpDir, 'Makefile'), '');
      expect(detectLanguage(tmpDir)).toBe('cpp');
    });

    it('returns unknown for directory without project files', () => {
      expect(detectLanguage(tmpDir)).toBe('unknown');
    });

    it('prioritizes TypeScript over Python when both project files exist', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}');
      fs.writeFileSync(path.join(tmpDir, 'pyproject.toml'), '');
      expect(detectLanguage(tmpDir)).toBe('typescript');
    });
  });
});
