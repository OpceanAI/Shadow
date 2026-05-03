import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface DataFlowNode {
  id: string;
  type: 'entry' | 'transform' | 'sink' | 'store' | 'external';
  file: string;
  line: number;
  description: string;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  data: string;
  transform?: string;
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}

export interface TaintSource {
  variable: string;
  file: string;
  line: number;
  source: 'user-input' | 'network' | 'file' | 'env' | 'database';
}

export interface TaintSink {
  variable: string;
  file: string;
  line: number;
  sink: 'sql' | 'command' | 'file-write' | 'network' | 'eval' | 'render';
}

export interface TaintPath {
  source: TaintSource;
  sink: TaintSink;
  path: Array<{
    variable: string;
    file: string;
    line: number;
    operation: string;
  }>;
}

export class DataFlowAnalyzer {
  analyze(projectPath?: string): DataFlowGraph {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs',
    ]);

    const nodes: DataFlowNode[] = [];
    const edges: DataFlowEdge[] = [];
    let nodeId = 0;

    for (const file of files) {
      try {
        const content = readFile(file);
        const fileNodes = this.extractDataFlowNodes(content, file, () => nodeId++);
        nodes.push(...fileNodes);

        const fileEdges = this.extractDataFlowEdges(content, file, fileNodes);
        edges.push(...fileEdges);
      } catch {
        // skip
      }
    }

    return { nodes, edges };
  }

  private extractDataFlowNodes(content: string, file: string, nextId: () => number): DataFlowNode[] {
    const nodes: DataFlowNode[] = [];
    const lines = content.split('\n');

    // Detect input sources (function parameters, readline, fetch, etc.)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (this.isUserInput(line)) {
        nodes.push({
          id: `node_${nextId()}`,
          type: 'entry',
          file,
          line: i + 1,
          description: this.extractVariableName(line),
        });
      }

      if (this.isNetworkCall(line)) {
        nodes.push({
          id: `node_${nextId()}`,
          type: 'external',
          file,
          line: i + 1,
          description: line.slice(0, 60),
        });
      }

      if (this.isTransform(line)) {
        nodes.push({
          id: `node_${nextId()}`,
          type: 'transform',
          file,
          line: i + 1,
          description: line.slice(0, 60),
        });
      }

      if (this.isSink(line)) {
        nodes.push({
          id: `node_${nextId()}`,
          type: 'sink',
          file,
          line: i + 1,
          description: line.slice(0, 60),
        });
      }

      if (this.isStore(line)) {
        nodes.push({
          id: `node_${nextId()}`,
          type: 'store',
          file,
          line: i + 1,
          description: line.slice(0, 60),
        });
      }
    }

    return nodes;
  }

  private isUserInput(line: string): boolean {
    const patterns = [
      /readline/,
      /prompt/,
      /process\.argv/,
      /req\.(body|query|params)/,
      /request\.(body|query|params)/,
      /input\(/,
      /scanf/,
      /read_line/,
    ];
    return patterns.some((p) => p.test(line));
  }

  private isNetworkCall(line: string): boolean {
    const patterns = [
      /fetch\(/,
      /axios\./,
      /\.get\(/,
      /\.post\(/,
      /requests\.(get|post|put|delete)/,
      /http\.(Get|Post)/,
      /reqwest/,
    ];
    return patterns.some((p) => p.test(line));
  }

  private isTransform(line: string): boolean {
    const patterns = [
      /\.map\(/,
      /\.filter\(/,
      /\.reduce\(/,
      /\.transform/,
      /JSON\.parse/,
      /JSON\.stringify/,
      /\.toString\(/,
      /parseInt/,
      /parseFloat/,
    ];
    return patterns.some((p) => p.test(line));
  }

  private isSink(line: string): boolean {
    const patterns = [
      /console\.(log|error|warn)/,
      /\.send\(/,
      /\.json\(/,
      /res\.(send|json|end)/,
      /writeFile/,
      /fs\.write/,
      /exec\(/,
      /spawn\(/,
      /eval\(/,
    ];
    return patterns.some((p) => p.test(line));
  }

  private isStore(line: string): boolean {
    const patterns = [
      /\.save\(/,
      /\.insert/,
      /\.update/,
      /\.create\(/,
      /\.upsert/,
      /\.delete/,
      /db\./,
      /redis\./,
      /\.find/,
    ];
    return patterns.some((p) => p.test(line));
  }

  private extractVariableName(line: string): string {
    const match = line.match(/(?:const|let|var|)\s*(\w+)\s*=/);
    return match ? match[1] : 'unknown';
  }

  private extractDataFlowEdges(content: string, file: string, nodes: DataFlowNode[]): DataFlowEdge[] {
    const edges: DataFlowEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        from: nodes[i].id,
        to: nodes[i + 1].id,
        data: `${file}:${nodes[i].line}→${nodes[i + 1].line}`,
      });
    }
    return edges;
  }

  traceTaint(): TaintPath[] {
    const paths: TaintPath[] = [];
    const files = findFiles(process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py',
    ]);

    for (const file of files) {
      try {
        const content = readFile(file);
        const sources = this.findTaintSources(content, file);
        const sinks = this.findTaintSinks(content, file);

        for (const source of sources) {
          for (const sink of sinks) {
            const path = this.buildTaintPath(content, source, sink);
            if (path) {
              paths.push(path);
            }
          }
        }
      } catch {
        // skip
      }
    }

    return paths;
  }

  private findTaintSources(content: string, file: string): TaintSource[] {
    const sources: TaintSource[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/(?:req|request)\.(?:body|query|params|cookies|headers)/.test(line)) {
        const varMatch = line.match(/(?:const|let|var)\s*(\w+)\s*=/);
        sources.push({
          variable: varMatch ? `req.${varMatch[1]}` : 'req.body',
          file,
          line: i + 1,
          source: 'user-input',
        });
      }

      if (/readline|prompt|process\.argv/.test(line)) {
        const varMatch = line.match(/(?:const|let|var)\s*(\w+)\s*=/);
        sources.push({
          variable: varMatch ? varMatch[1] : 'input',
          file,
          line: i + 1,
          source: 'user-input',
        });
      }

      if (/fs\.read|readFile/.test(line)) {
        const varMatch = line.match(/(?:const|let|var)\s*(\w+)\s*=/);
        sources.push({
          variable: varMatch ? varMatch[1] : 'data',
          file,
          line: i + 1,
          source: 'file',
        });
      }

      if (/process\.env\./.test(line)) {
        const match = line.match(/process\.env\.(\w+)/);
        sources.push({
          variable: match ? `process.env.${match[1]}` : 'process.env',
          file,
          line: i + 1,
          source: 'env',
        });
      }
    }

    return sources;
  }

  private findTaintSinks(content: string, file: string): TaintSink[] {
    const sinks: TaintSink[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/\.query\(|\.execute\(|\.raw\(/.test(line)) {
        const varMatch = line.match(/(\w+)\s*(?:\.query|\.execute|\.raw)/);
        sinks.push({
          variable: varMatch ? varMatch[1] : 'db',
          file,
          line: i + 1,
          sink: 'sql',
        });
      }

      if (/exec\(|spawn\(|execSync\(|execFileSync\(/.test(line)) {
        const varMatch = line.match(/exec\w*\(\s*(\w+)/);
        sinks.push({
          variable: varMatch ? varMatch[1] : 'cmd',
          file,
          line: i + 1,
          sink: 'command',
        });
      }

      if (/fs\.write|writeFile/.test(line)) {
        sinks.push({
          variable: 'data',
          file,
          line: i + 1,
          sink: 'file-write',
        });
      }

      if (/eval\(/.test(line)) {
        sinks.push({
          variable: 'code',
          file,
          line: i + 1,
          sink: 'eval',
        });
      }

      if (/\.send\(|\.json\(/.test(line)) {
        sinks.push({
          variable: 'response',
          file,
          line: i + 1,
          sink: 'network',
        });
      }

      if (/\.render\(|innerHTML|dangerouslySetInnerHTML/.test(line)) {
        sinks.push({
          variable: 'html',
          file,
          line: i + 1,
          sink: 'render',
        });
      }
    }

    return sinks;
  }

  private buildTaintPath(content: string, source: TaintSource, sink: TaintSink): TaintPath | null {
    if (source.line > sink.line) return null;

    return {
      source,
      sink,
      path: [
        {
          variable: source.variable,
          file: source.file,
          line: source.line,
          operation: `Source: ${source.source}`,
        },
        {
          variable: sink.variable,
          file: sink.file,
          line: sink.line,
          operation: `Sink: ${sink.sink}`,
        },
      ],
    };
  }

  detectSensitiveDataFlows(): Array<{
    type: string;
    source: string;
    sink: string;
    severity: 'high' | 'medium' | 'low';
    file: string;
  }> {
    const findings: Array<{
      type: string;
      source: string;
      sink: string;
      severity: 'high' | 'medium' | 'low';
      file: string;
    }> = [];

    const taintPaths = this.traceTaint();

    for (const path of taintPaths) {
      if (path.sink.sink === 'eval' && path.source.source === 'user-input') {
        findings.push({
          type: 'Code Injection',
          source: `${path.source.file}:${path.source.line}`,
          sink: `${path.sink.file}:${path.sink.line}`,
          severity: 'high',
          file: path.source.file,
        });
      }

      if (path.sink.sink === 'sql' && path.source.source === 'user-input') {
        findings.push({
          type: 'SQL Injection',
          source: `${path.source.file}:${path.source.line}`,
          sink: `${path.sink.file}:${path.sink.line}`,
          severity: 'high',
          file: path.source.file,
        });
      }

      if (path.sink.sink === 'command' && path.source.source === 'user-input') {
        findings.push({
          type: 'Command Injection',
          source: `${path.source.file}:${path.source.line}`,
          sink: `${path.sink.file}:${path.sink.line}`,
          severity: 'high',
          file: path.source.file,
        });
      }

      if (path.sink.sink === 'render' && path.source.source === 'user-input') {
        findings.push({
          type: 'XSS',
          source: `${path.source.file}:${path.source.line}`,
          sink: `${path.sink.file}:${path.sink.line}`,
          severity: 'high',
          file: path.source.file,
        });
      }
    }

    return findings;
  }
}

export function printDataFlow(): void {
  const analyzer = new DataFlowAnalyzer();
  const flow = analyzer.analyze();

  console.log(chalk.bold.blue('\n[shadow dataflow]\n'));

  const byType: Record<string, number> = {};
  for (const node of flow.nodes) {
    byType[node.type] = (byType[node.type] || 0) + 1;
  }

  console.log(chalk.bold('Data Flow Nodes:'));
  for (const [type, count] of Object.entries(byType).sort()) {
    const typeColor = type === 'entry' ? chalk.green
      : type === 'sink' ? chalk.red
        : type === 'store' ? chalk.yellow
          : type === 'external' ? chalk.magenta
            : chalk.cyan;
    console.log(`  ${typeColor(type)}: ${count}`);
  }

  console.log(chalk.bold(`\nEdges: ${flow.edges.length}`));

  const sensitive = analyzer.detectSensitiveDataFlows();
  if (sensitive.length > 0) {
    console.log(chalk.bold.red(`\nSensitive Data Flows Detected: ${sensitive.length}`));
    for (const finding of sensitive) {
      console.log(`  ${chalk.red('⛔')} ${finding.type} [${finding.severity}]`);
      console.log(chalk.dim(`     ${finding.source} → ${finding.sink}`));
    }
  } else {
    console.log(chalk.green('\nNo sensitive data flows detected.'));
  }
  console.log();
}
