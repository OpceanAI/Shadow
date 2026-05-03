import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface CFGBasicBlock {
  id: string;
  label: string;
  startLine: number;
  endLine: number;
  isEntry: boolean;
  isExit: boolean;
  statements: string[];
}

export interface CFGEdge {
  from: string;
  to: string;
  type: 'sequential' | 'branch_true' | 'branch_false' | 'loop' | 'call' | 'return';
  condition?: string;
}

export interface ControlFlowGraph {
  function: string;
  file: string;
  blocks: CFGBasicBlock[];
  edges: CFGEdge[];
  entryBlock: string;
  exitBlock: string;
}

export interface UnreachableCode {
  file: string;
  line: number;
  code: string;
  reason: string;
}

export interface ComplexityHotspot {
  file: string;
  function: string;
  line: number;
  complexity: number;
  linesOfCode: number;
  nestingDepth: number;
}

export interface CFGAnalysis {
  graphs: ControlFlowGraph[];
  unreachableCode: UnreachableCode[];
  hotspots: ComplexityHotspot[];
}

export class ControlFlowAnalyzer {
  analyze(projectPath?: string): CFGAnalysis {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const graphs: ControlFlowGraph[] = [];
    const unreachable: UnreachableCode[] = [];
    const hotspots: ComplexityHotspot[] = [];

    for (const file of files) {
      try {
        const content = readFile(file);
        const functions = this.extractFunctionBodies(content, file);

        for (const fn of functions) {
          const cfg = this.buildCFG(fn.name, file, fn.body, fn.startLine);
          graphs.push(cfg);
          unreachable.push(...this.detectUnreachable(cfg));
        }

        const complex = this.findComplexityHotspots(content, file);
        hotspots.push(...complex);
      } catch {
        // skip
      }
    }

    return { graphs, unreachableCode: unreachable, hotspots };
  }

  private extractFunctionBodies(
    content: string,
    file: string,
  ): Array<{ name: string; startLine: number; body: string }> {
    const functions: Array<{ name: string; startLine: number; body: string }> = [];
    const lines = content.split('\n');

    // Match function declarations (TS/JS)
    const fnRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/;
    let inFunction = false;
    let fnName = '';
    let fnStart = 0;
    let braceDepth = 0;
    const fnLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inFunction) {
        const match = line.match(fnRegex);
        if (match) {
          fnName = match[1] || match[2] || 'anonymous';
          fnStart = i + 1;
          inFunction = true;
          braceDepth = 0;
          fnLines.length = 0;

          if (line.includes('{')) {
            braceDepth += (line.match(/\{/g) || []).length;
            braceDepth -= (line.match(/\}/g) || []).length;
            fnLines.push(line);
            if (braceDepth === 0) {
              functions.push({ name: fnName, startLine: fnStart, body: fnLines.join('\n') });
              inFunction = false;
            }
          } else {
            fnLines.push(line);
          }
        }
      } else {
        fnLines.push(line);
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;

        if (braceDepth <= 0) {
          functions.push({ name: fnName, startLine: fnStart, body: fnLines.join('\n') });
          inFunction = false;
        }
      }
    }

    // Python functions
    const pyFnRegex = /^def\s+(\w+)\s*\(/m;
    const pyLines = content.split('\n');
    let pyFnName = '';
    let pyFnStart = 0;
    let pyFnLines: string[] = [];
    let inPyFn = false;

    for (let i = 0; i < pyLines.length; i++) {
      const line = pyLines[i];
      if (!inPyFn) {
        const match = line.match(pyFnRegex);
        if (match && (line.startsWith('def') || line.startsWith('    def'))) {
          pyFnName = match[1];
          pyFnStart = i + 1;
          inPyFn = true;
          pyFnLines = [line];
        }
      } else {
        if (line.trim() === '' || line.startsWith(' ') || line.startsWith('\t') || line.startsWith('def')) {
          if (line.match(pyFnRegex) && line.startsWith('def')) {
            functions.push({ name: pyFnName, startLine: pyFnStart, body: pyFnLines.join('\n') });
            pyFnName = (line.match(pyFnRegex) as RegExpMatchArray)[1];
            pyFnStart = i + 1;
            pyFnLines = [line];
          } else {
            pyFnLines.push(line);
          }
        } else {
          functions.push({ name: pyFnName, startLine: pyFnStart, body: pyFnLines.join('\n') });
          inPyFn = false;
        }
      }
    }
    if (inPyFn) {
      functions.push({ name: pyFnName, startLine: pyFnStart, body: pyFnLines.join('\n') });
    }

    // Go functions
    const goFnRegex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/;
    let inGoFn = false;
    let goFnName = '';
    let goFnStart = 0;
    let goBraceDepth = 0;
    const goFnLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!inGoFn) {
        const match = line.match(goFnRegex);
        if (match) {
          goFnName = match[1];
          goFnStart = i + 1;
          inGoFn = true;
          goBraceDepth = 0;
          goFnLines.length = 0;
          goFnLines.push(line);
          goBraceDepth += (line.match(/\{/g) || []).length;
          goBraceDepth -= (line.match(/\}/g) || []).length;
          if (goBraceDepth <= 0) {
            functions.push({ name: goFnName, startLine: goFnStart, body: goFnLines.join('\n') });
            inGoFn = false;
          }
        }
      } else {
        goFnLines.push(line);
        goBraceDepth += (line.match(/\{/g) || []).length;
        goBraceDepth -= (line.match(/\}/g) || []).length;
        if (goBraceDepth <= 0) {
          functions.push({ name: goFnName, startLine: goFnStart, body: goFnLines.join('\n') });
          inGoFn = false;
        }
      }
    }

    return functions;
  }

  buildCFG(fnName: string, file: string, body: string, startLine: number): ControlFlowGraph {
    const lines = body.split('\n');
    const blocks: CFGBasicBlock[] = [];
    const edges: CFGEdge[] = [];
    let blockId = 0;

    const nextBlockId = () => `${fnName}_b${blockId++}`;

    const entryId = nextBlockId();
    const entryBlock: CFGBasicBlock = {
      id: entryId,
      label: 'entry',
      startLine,
      endLine: startLine,
      isEntry: true,
      isExit: false,
      statements: [],
    };
    blocks.push(entryBlock);

    let currentBlock = entryBlock;
    const blockLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      const isBranch = /^(if|else\s*if|switch|case)\b/.test(trimmed);
      const isLoop = /^(for|while|do)\b/.test(trimmed);
      const isReturn = /^return\b/.test(trimmed) || /^yield\b/.test(trimmed);
      const isBreak = /^break\b/.test(trimmed) || /^continue\b/.test(trimmed);

      if ((isBranch || isLoop || isReturn || isBreak) && blockLines.length > 0) {
        const blockId = nextBlockId();
        const block: CFGBasicBlock = {
          id: blockId,
          label: 'code',
          startLine: startLine + i - blockLines.length,
          endLine: startLine + i - 1,
          isEntry: false,
          isExit: false,
          statements: [...blockLines],
        };
        blocks.push(block);
        edges.push({ from: currentBlock.id, to: blockId, type: 'sequential' });
        currentBlock = block;
        blockLines.length = 0;
      }

      blockLines.push(line);

      if (isBranch) {
        const branchId = nextBlockId();
        const branchBlock: CFGBasicBlock = {
          id: branchId,
          label: 'branch',
          startLine: startLine + i,
          endLine: startLine + i,
          isEntry: false,
          isExit: false,
          statements: [line],
        };
        blocks.push(branchBlock);
        edges.push({ from: currentBlock.id, to: branchId, type: 'branch_true', condition: trimmed });
        edges.push({ from: branchId, to: currentBlock.id, type: 'branch_false' });
        currentBlock = branchBlock;
        blockLines.length = 0;
      }

      if (isLoop) {
        const loopId = nextBlockId();
        const loopBlock: CFGBasicBlock = {
          id: loopId,
          label: 'loop',
          startLine: startLine + i,
          endLine: startLine + i,
          isEntry: false,
          isExit: false,
          statements: [line],
        };
        blocks.push(loopBlock);
        edges.push({ from: currentBlock.id, to: loopId, type: 'loop' });
        edges.push({ from: loopId, to: loopId, type: 'loop' });
        currentBlock = loopBlock;
        blockLines.length = 0;
      }

      if (isReturn || isBreak) {
        const exitId = nextBlockId();
        const exitBlock: CFGBasicBlock = {
          id: exitId,
          label: 'exit',
          startLine: startLine + i,
          endLine: startLine + i,
          isEntry: false,
          isExit: true,
          statements: [line],
        };
        blocks.push(exitBlock);
        edges.push({ from: currentBlock.id, to: exitId, type: 'return' });
        currentBlock = exitBlock;
        blockLines.length = 0;
      }
    }

    if (blockLines.length > 0) {
      const blockId = nextBlockId();
      const block: CFGBasicBlock = {
        id: blockId,
        label: 'code',
        startLine: startLine + lines.length - blockLines.length,
        endLine: startLine + lines.length - 1,
        isEntry: false,
        isExit: false,
        statements: [...blockLines],
      };
      blocks.push(block);
      edges.push({ from: currentBlock.id, to: blockId, type: 'sequential' });
    }

    const exitId = nextBlockId();
    const exitBlock: CFGBasicBlock = {
      id: exitId,
      label: 'exit',
      startLine: startLine + lines.length,
      endLine: startLine + lines.length,
      isEntry: false,
      isExit: true,
      statements: [],
    };
    blocks.push(exitBlock);

    return {
      function: fnName,
      file,
      blocks,
      edges,
      entryBlock: entryId,
      exitBlock: exitId,
    };
  }

  detectUnreachable(cfg: ControlFlowGraph): UnreachableCode[] {
    const unreachable: UnreachableCode[] = [];

    const reachable = new Set<string>();
    const queue = [cfg.entryBlock];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      for (const edge of cfg.edges) {
        if (edge.from === current) {
          queue.push(edge.to);
        }
      }
    }

    for (const block of cfg.blocks) {
      if (!reachable.has(block.id) && !block.isExit) {
        for (const stmt of block.statements) {
          if (stmt.trim()) {
            unreachable.push({
              file: cfg.file,
              line: block.startLine,
              code: stmt.trim().slice(0, 80),
              reason: 'Code after unconditional return/break',
            });
          }
        }
      }
    }

    return unreachable;
  }

  findComplexityHotspots(content: string, file: string): ComplexityHotspot[] {
    const hotspots: ComplexityHotspot[] = [];
    const functions = this.extractFunctionBodies(content, file);

    for (const fn of functions) {
      const complexity = this.computeCyclomaticComplexity(fn.body);
      const loc = fn.body.split('\n').length;
      const nesting = this.computeNestingDepth(fn.body);

      if (complexity > 10 || loc > 30 || nesting > 3) {
        hotspots.push({
          file,
          function: fn.name,
          line: fn.startLine,
          complexity,
          linesOfCode: loc,
          nestingDepth: nesting,
        });
      }
    }

    hotspots.sort((a, b) => b.complexity - a.complexity);
    return hotspots;
  }

  private computeCyclomaticComplexity(body: string): number {
    let complexity = 1;
    const patterns = [
      /\bif\b/g,
      /\belse\s+if\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?\s*[^:]+:/g,
    ];

    for (const pattern of patterns) {
      const matches = body.match(pattern);
      if (matches) complexity += matches.length;
    }

    return complexity;
  }

  private computeNestingDepth(body: string): number {
    const lines = body.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(if|for|while|try|switch|match)\b/.test(trimmed) || /\{\s*$/.test(trimmed)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      if (/^\s*\}.*$/.test(trimmed) || /^\s*\)\s*[:{].*$/.test(trimmed)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  toDOT(cfg: ControlFlowGraph): string {
    const lines: string[] = ['digraph CFG {', '  rankdir=TB;', `  label="${cfg.function}";`];

    for (const block of cfg.blocks) {
      const shape = block.isEntry || block.isExit ? 'doublecircle' : 'box';
      const label = block.statements.map((s) => s.trim().slice(0, 40)).join('\\n') || block.label;
      lines.push(`  ${block.id} [shape=${shape}, label="${label.replace(/"/g, '\\"')}"];`);
    }

    for (const edge of cfg.edges) {
      const style = edge.type === 'branch_true' ? 'color=green'
        : edge.type === 'branch_false' ? 'color=red'
          : edge.type === 'loop' ? 'color=blue'
            : '';
      lines.push(`  ${edge.from} -> ${edge.to} [${style}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }
}

export function printControlFlow(): void {
  const analyzer = new ControlFlowAnalyzer();
  const analysis = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow controlflow]\n'));

  console.log(chalk.bold(`Functions analyzed: ${analysis.graphs.length}`));
  console.log(chalk.bold(`Unreachable code blocks: ${analysis.unreachableCode.length}`));
  console.log(chalk.bold(`Complexity hotspots: ${analysis.hotspots.length}`));
  console.log();

  if (analysis.hotspots.length > 0) {
    console.log(chalk.bold.yellow('Complexity Hotspots (top 10):'));
    for (const h of analysis.hotspots.slice(0, 10)) {
      const sev = h.complexity > 20 ? chalk.red : h.complexity > 10 ? chalk.yellow : chalk.gray;
      console.log(`  ${sev(`CCN=${h.complexity}`)} ${chalk.cyan(h.function)} ${chalk.dim(`(${h.file}:${h.line})`)}`);
    }
    console.log();
  }

  if (analysis.unreachableCode.length > 0) {
    console.log(chalk.bold.red('Unreachable Code:'));
    for (const u of analysis.unreachableCode.slice(0, 10)) {
      console.log(`  ${chalk.red('✗')} ${chalk.dim(`${u.file}:${u.line}`)} - ${u.code}`);
    }
    console.log();
  }
}
