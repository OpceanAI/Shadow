export { KnowledgeGraphBuilder, buildKnowledgeGraph, printKnowledgeGraph } from './knowledge-graph';
export type { KnowledgeEntity, KnowledgeRelation, KnowledgeGraph, JsonLdContext } from './knowledge-graph';

export { SemanticSearchEngine, printSemanticSearch } from './semantic-search';
export type { SearchDocument, SearchResult, TfIdfIndex } from './semantic-search';

export { CodeSimilarityDetector, printSimilarities } from './similarity';
export type { SimilarityPair, DuplicateBlock, SimilarityReport } from './similarity';

export { ArchitectureAnalyzer, printArchitecture } from './architecture';
export type { ArchitecturePattern, LayerInfo, ArchitectureAnalysis, ArchitectureDecision, C4Model, C4System, C4Container, C4Component } from './architecture';

export { DataFlowAnalyzer, printDataFlow } from './dataflow';
export type { DataFlowNode, DataFlowEdge, DataFlowGraph, TaintSource, TaintSink, TaintPath } from './dataflow';

export { ControlFlowAnalyzer, printControlFlow } from './control-flow';
export type { CFGBasicBlock, CFGEdge, ControlFlowGraph, UnreachableCode, ComplexityHotspot, CFGAnalysis } from './control-flow';

export { CallGraphBuilder, printCallGraph } from './call-graph';
export type { CallNode, CallEdge, CallGraph, CallChain } from './call-graph';

export { TypeInferenceEngine, printTypeInference } from './type-inference';
export type { InferredType, TypeScriptDeclaration, TypeMismatch, TypeInferenceResult } from './type-inference';

export { APIContractExtractor, printAPIContracts } from './api-contract';
export type { APIContract, ContractValidation, ContractIssue, ContractChange } from './api-contract';

export { DBSchemaAnalyzer, printDBSchema } from './db-schema';
export type { TableSchema, ColumnSchema, IndexSchema, ForeignKeySchema, SchemaChange, SchemaDiff, DBSchemaReport } from './db-schema';

export { IaCAnalyzer, printIaC } from './iasc';
export type { IaCResource, IaCDependency, IaCResourceGraph, SecurityGroupRule, SecurityAnalysis, CostEstimate } from './iasc';

export { MonorepoAnalyzer, printMonorepo } from './monorepo';
export type { WorkspacePackage, PackageDependency, ImpactAnalysis, MonorepoAnalysis } from './monorepo';

export { OwnershipAnalyzer, printOwnership } from './ownership';
export type { BlameInfo, FileOwnership, ModuleOwnership, KnowledgeSilo, OwnershipReport } from './ownership';

export { TechDebtEstimator, printTechDebt } from './tech-debt';
export type { DebtScore, DebtTrend, RefactoringSuggestion, TechDebtReport } from './tech-debt';

export { CodeSmellDetector, printSmells } from './smells';
export type { CodeSmell, CodeSmellReport } from './smells';

export { PatternDetector, printPatterns } from './patterns';
export type { DetectedPattern, PatternReport } from './patterns';

export { AntiPatternDetector, printAntiPatterns } from './anti-patterns';
export type { AntiPattern, AntiPatternReport } from './anti-patterns';

export { TrendAnalyzer, printTrends } from './trends';
export type { MetricSnapshot, TrendData, TrendPrediction, TrendReport } from './trends';

export { RefactoringPlanner, printRefactorPlan } from './refactor-plan';
export type { RefactoringStep, RefactoringPlan } from './refactor-plan';
