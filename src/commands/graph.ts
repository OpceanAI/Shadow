import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { GraphBuilder } from '../core/graph';
import { printGraphText } from '../output/human';
import { printJSON } from '../output/json';

export function graphCommand(program: Command): void {
  program
    .command('graph')
    .description('Build a dependency and flow graph')
    .option('--file <path>', 'Graph a specific file')
    .option('--focus <name>', 'Focus on a specific module')
    .option('--json', 'Output as JSON')
    .option('--dot', 'Output as DOT')
    .option('--svg', 'Output as SVG')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const builder = new GraphBuilder();

      const project = analyzer.analyzeProject();
      const graph = builder.buildFromFiles(project.files);

      if (options.json) {
        printJSON(graph);
      } else if (options.dot) {
        console.log(builder.toDOT(graph));
      } else if (options.svg) {
        console.log('# SVG output requires dot (Graphviz) installed');
        console.log(builder.toDOT(graph));
      } else {
        printGraphText(graph);
      }
    });
}
