import { Command } from 'commander';
import { printKnowledgeGraph, KnowledgeGraphBuilder } from '../advanced/knowledge-graph';
import { printSemanticSearch, SemanticSearchEngine } from '../advanced/semantic-search';
import { printSimilarities, CodeSimilarityDetector } from '../advanced/similarity';
import { printArchitecture, ArchitectureAnalyzer } from '../advanced/architecture';
import { printDataFlow, DataFlowAnalyzer } from '../advanced/dataflow';
import { printControlFlow, ControlFlowAnalyzer } from '../advanced/control-flow';
import { printCallGraph, CallGraphBuilder } from '../advanced/call-graph';
import { printTypeInference, TypeInferenceEngine } from '../advanced/type-inference';
import { printAPIContracts, APIContractExtractor } from '../advanced/api-contract';
import { printDBSchema, DBSchemaAnalyzer } from '../advanced/db-schema';
import { printIaC, IaCAnalyzer } from '../advanced/iasc';
import { printMonorepo, MonorepoAnalyzer } from '../advanced/monorepo';
import { printOwnership, OwnershipAnalyzer } from '../advanced/ownership';
import { printTechDebt, TechDebtEstimator } from '../advanced/tech-debt';
import { printSmells, CodeSmellDetector } from '../advanced/smells';
import { printPatterns, PatternDetector } from '../advanced/patterns';
import { printAntiPatterns, AntiPatternDetector } from '../advanced/anti-patterns';
import { printTrends, TrendAnalyzer } from '../advanced/trends';
import { printRefactorPlan, RefactoringPlanner } from '../advanced/refactor-plan';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function advancedCommand(program: Command): void {
  const advanced = program
    .command('advanced')
    .description('Advanced codebase analysis and intelligence tools');

  const kg = advanced
    .command('knowledge-graph')
    .description('Build semantic knowledge graph of codebase')
    .option('--json', 'JSON output')
    .option('--jsonld', 'JSON-LD output')
    .option('--neo4j', 'Neo4j Cypher output')
    .action((options) => {
      if (options.jsonld) {
        const builder = new KnowledgeGraphBuilder();
        builder.build();
        printJSON(builder.toJsonLd());
        return;
      }
      if (options.neo4j) {
        const builder = new KnowledgeGraphBuilder();
        builder.build();
        console.log(builder.toNeo4jCypher());
        return;
      }
      if (options.json) {
        const builder = new KnowledgeGraphBuilder();
        const kg = builder.build();
        printJSON(kg);
        return;
      }
      printKnowledgeGraph();
    });

  advanced
    .command('semantic-search [query]')
    .description('Semantic code search with TF-IDF ranking')
    .option('--regex', 'Use regex search')
    .option('--fuzzy', 'Use fuzzy matching')
    .option('--json', 'JSON output')
    .action((query, options) => {
      if (!query) {
        console.log(chalk.yellow('Please provide a search query. Example: shadow advanced semantic-search "authentication logic"'));
        return;
      }
      if (options.json) {
        const engine = new SemanticSearchEngine();
        engine.indexProject();
        printJSON(engine.search(query, { regex: options.regex, fuzzy: options.fuzzy }));
        return;
      }
      printSemanticSearch(query, { regex: options.regex, fuzzy: options.fuzzy });
    });

  advanced
    .command('similarities')
    .alias('sim')
    .description('Detect code similarities and potential duplicates')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const detector = new CodeSimilarityDetector();
        printJSON(detector.analyze());
        return;
      }
      printSimilarities();
    });

  advanced
    .command('architecture')
    .alias('arch')
    .description('Analyze and detect architectural patterns')
    .option('--json', 'JSON output')
    .option('--c4', 'Generate C4 model')
    .action((options) => {
      if (options.c4) {
        const analyzer = new ArchitectureAnalyzer();
        printJSON(analyzer.generateC4Model());
        return;
      }
      if (options.json) {
        const analyzer = new ArchitectureAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printArchitecture();
    });

  advanced
    .command('dataflow')
    .alias('df')
    .description('Analyze data flow and taint tracking')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const analyzer = new DataFlowAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printDataFlow();
    });

  advanced
    .command('controlflow')
    .alias('cfg')
    .description('Build control flow graphs per function')
    .option('--json', 'JSON output')
    .option('--dot', 'Export as DOT format')
    .action((options) => {
      if (options.dot) {
        const analyzer = new ControlFlowAnalyzer();
        const analysis = analyzer.analyze();
        for (const cfg of analysis.graphs.slice(0, 10)) {
          console.log(analyzer.toDOT(cfg));
          console.log();
        }
        return;
      }
      if (options.json) {
        const analyzer = new ControlFlowAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printControlFlow();
    });

  advanced
    .command('callgraph')
    .alias('cg')
    .description('Build full cross-file call graph')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const builder = new CallGraphBuilder();
        printJSON(builder.build());
        return;
      }
      printCallGraph();
    });

  advanced
    .command('typeinference')
    .alias('ti')
    .description('Infer TypeScript types from JavaScript code')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const engine = new TypeInferenceEngine();
        printJSON(engine.infer());
        return;
      }
      printTypeInference();
    });

  advanced
    .command('apicontract')
    .alias('api')
    .description('API contract extraction and validation')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const extractor = new APIContractExtractor();
        printJSON(extractor.extract());
        return;
      }
      printAPIContracts();
    });

  advanced
    .command('dbschema')
    .alias('db')
    .description('Database schema analysis from code')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const analyzer = new DBSchemaAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printDBSchema();
    });

  advanced
    .command('iasc')
    .description('Infrastructure as Code analysis (Terraform, CFN, Pulumi)')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const analyzer = new IaCAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printIaC();
    });

  advanced
    .command('monorepo')
    .alias('mono')
    .description('Monorepo workspace analysis')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const analyzer = new MonorepoAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printMonorepo();
    });

  advanced
    .command('ownership')
    .alias('own')
    .description('Code ownership and bus factor analysis')
    .option('--json', 'JSON output')
    .action(async (options) => {
      if (options.json) {
        const analyzer = new OwnershipAnalyzer();
        printJSON(await analyzer.analyze());
        return;
      }
      await printOwnership();
    });

  advanced
    .command('debt')
    .description('Technical debt estimation and scoring')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const estimator = new TechDebtEstimator();
        printJSON(estimator.estimate());
        return;
      }
      printTechDebt();
    });

  advanced
    .command('smells')
    .description('Code smell detection')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const detector = new CodeSmellDetector();
        printJSON(detector.detect());
        return;
      }
      printSmells();
    });

  advanced
    .command('patterns')
    .description('Design pattern detection')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const detector = new PatternDetector();
        printJSON(detector.detect());
        return;
      }
      printPatterns();
    });

  advanced
    .command('antipatterns')
    .alias('ap')
    .description('Anti-pattern detection')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const detector = new AntiPatternDetector();
        printJSON(detector.detect());
        return;
      }
      printAntiPatterns();
    });

  advanced
    .command('trends')
    .description('Code trend analysis over git history')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const analyzer = new TrendAnalyzer();
        printJSON(analyzer.analyze());
        return;
      }
      printTrends();
    });

  advanced
    .command('refactorplan')
    .alias('refactor')
    .description('AI-assisted refactoring plan')
    .option('--json', 'JSON output')
    .action((options) => {
      if (options.json) {
        const planner = new RefactoringPlanner();
        printJSON(planner.generatePlan());
        return;
      }
      printRefactorPlan();
    });
}
