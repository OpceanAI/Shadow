import { Command } from 'commander';
import { loadConfig } from '../core/config';
import { Analyzer } from '../core/analyzer';
import { GraphBuilder } from '../core/graph';
import { projectInfoToMarkdown, graphToMarkdown } from '../output/markdown';
import { printJSON, graphToJSON, projectInfoToJSON } from '../output/json';
import { generateOpenAPI, openapiToJSON, openapiToYAML } from '../output/openapi';
import { generatePostman, postmanToJSON } from '../output/postman';
import { buildSVGFromGraph } from '../output/svg';
import { generateHTMLReport } from '../output/html';
import { graphToMermaid, graphToMermaidFlowchart } from '../output/mermaid';
import { graphToPlantUML, projectToPlantUML } from '../output/plantuml';
import { formatTable, TableColumn } from '../output/table';
import { writeFile } from '../utils/fs';
import chalk from 'chalk';
import * as path from 'path';

export function exportCommand(program: Command): void {
  program
    .command('export')
    .description('Export Shadow findings to various formats')
    .option('--json', 'Export as JSON')
    .option('--md', 'Export as Markdown')
    .option('--html', 'Export as self-contained HTML report')
    .option('--csv', 'Export as CSV (for files/data table)')
    .option('--xml', 'Export as XML')
    .option('--mermaid', 'Export as Mermaid.js diagram')
    .option('--plantuml', 'Export as PlantUML diagram')
    .option('--pdf', 'Export as PDF (HTML-based)')
    .option('--graph <format>', 'Export graph (dot|svg)')
    .option('--openapi', 'Export as OpenAPI 3.0 spec')
    .option('--openapi-format <format>', 'OpenAPI output format (json|yaml)', 'json')
    .option('--postman', 'Export as Postman Collection v2.1')
    .option('--patch', 'Export suggested patches')
    .option('--output <file>', 'Output file path')
    .option('--paged', 'Paginate output (less-style)')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();
      const builder = new GraphBuilder();
      const graph = builder.buildFromFiles(project.files);

      let output = '';
      let ext = '';

      if (options.json) {
        output = JSON.stringify({
          project: projectInfoToJSON(project),
          graph: graphToJSON(graph),
        }, null, 2);
        ext = '.json';
      } else if (options.md) {
        output = projectInfoToMarkdown(project) + '\n\n' + graphToMarkdown(graph);
        ext = '.md';
      } else if (options.html) {
        const fullProject = { ...project, graph };
        output = generateHTMLReport(fullProject, true);
        ext = '.html';
      } else if (options.csv) {
        output = generateCSV(project);
        ext = '.csv';
      } else if (options.xml) {
        output = generateXML(project, graph);
        ext = '.xml';
      } else if (options.mermaid) {
        output = graphToMermaidFlowchart(graph);
        ext = '.mmd';
      } else if (options.plantuml) {
        output = graphToPlantUML(graph, project.name);
        ext = '.puml';
      } else if (options.pdf) {
        const fullProject = { ...project, graph };
        output = generateHTMLReport(fullProject, true);
        ext = '.html';
        if (options.output) {
          console.log(chalk.yellow('Note: PDF export generates an HTML file. Use a browser or tool like wkhtmltopdf to convert.'));
        }
      } else if (options.graph) {
        const format = options.graph;
        if (format === 'dot') {
          output = builder.toDOT(graph);
          ext = '.dot';
        } else if (format === 'svg') {
          output = buildSVGFromGraph(graph);
          ext = '.svg';
        } else {
          output = builder.toDOT(graph);
          ext = '.dot';
        }
      } else if (options.openapi) {
        const spec = generateOpenAPI(project);
        if (options.openapiFormat === 'yaml' || options.openapiFormat === 'yml') {
          output = openapiToYAML(spec);
          ext = '.yaml';
        } else {
          output = openapiToJSON(spec);
          ext = '.json';
        }
      } else if (options.postman) {
        const collection = generatePostman(project);
        output = postmanToJSON(collection);
        ext = '.postman_collection.json';
      } else {
        output = projectInfoToMarkdown(project);
        ext = '.md';
      }

      if (options.output) {
        const outPath = path.resolve(options.output);
        writeFile(outPath, output);
        console.log(chalk.green(`✓ Exported to ${outPath}`));
      } else {
        console.log(output);
      }
    });
}

function generateCSV(project: ReturnType<Analyzer['analyzeProject']>): string {
  const headers = ['Path', 'Language', 'Purpose', 'Functions', 'Classes', 'Imports', 'EnvVars', 'ExternalCalls'];
  const rows = project.files.map((f) => [
    escapeCSV(f.path),
    escapeCSV(f.language),
    escapeCSV(f.purpose),
    String(f.functions.length),
    String(f.classes.length),
    escapeCSV(f.imports.map((i) => i.name).join('; ')),
    escapeCSV(f.envVars.join('; ')),
    escapeCSV(f.externalCalls.join('; ')),
  ]);

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ];
  return csvLines.join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function generateXML(project: ReturnType<Analyzer['analyzeProject']>, graph: ReturnType<GraphBuilder['buildFromFiles']>): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<shadow project="${escapeXML(project.name)}" language="${escapeXML(project.language)}">`);

  lines.push('  <summary>');
  lines.push(`    ${escapeXML(project.summary)}`);
  lines.push('  </summary>');

  lines.push('  <files>');
  for (const file of project.files) {
    lines.push(`    <file path="${escapeXML(file.path)}" language="${escapeXML(file.language)}" purpose="${escapeXML(file.purpose)}">`);
    for (const imp of file.imports) {
      lines.push(`      <import type="${imp.type}">${escapeXML(imp.name)}</import>`);
    }
    for (const fn of file.functions) {
      lines.push(`      <function>${escapeXML(fn)}</function>`);
    }
    for (const cls of file.classes) {
      lines.push(`      <class>${escapeXML(cls)}</class>`);
    }
    for (const env of file.envVars) {
      lines.push(`      <env>${escapeXML(env)}</env>`);
    }
    lines.push('    </file>');
  }
  lines.push('  </files>');

  lines.push('  <graph>');
  for (const edge of graph.edges) {
    lines.push(`    <edge from="${escapeXML(edge.from)}" to="${escapeXML(edge.to)}" type="${escapeXML(edge.type)}"/>`);
  }
  lines.push('  </graph>');

  lines.push('</shadow>');
  return lines.join('\n');
}

function escapeXML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
