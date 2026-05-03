export { ASTEngine } from './engine';
export type { ASTEngineOptions } from './engine';

export { parsePython, extractPythonImports, extractPythonFunctions, extractPythonClasses, extractPythonRoutes, extractPythonCalls } from './python-parser';
export type { PythonParseResult } from './python-parser';

export { parseTypeScript, extractJSXComponents, extractHooks, extractTypeScriptImports, extractTypeScriptExports, extractTSFunctions, extractTSClasses, extractTSInterfaces, extractTSTypes, extractTSRoutes, extractTSCalls } from './typescript-parser';
export type { TypeScriptParseResult } from './typescript-parser';

export { parseGo, extractGoImports, extractGoFunctions, extractGoStructs, extractGoInterfaces, extractGoRoutes, extractGoCalls } from './go-parser';
export type { GoParseResult } from './go-parser';

export { parseRust, extractRustImports, extractRustFunctions, extractRustStructs, extractRustEnums, extractRustTraits, extractRustImpls, extractRustRoutes, extractRustCalls } from './rust-parser';
export type { RustParseResult } from './rust-parser';

export {
  parsePythonRegex,
  parseTypeScriptRegex,
  parseGoRegex,
  parseRustRegex,
  parseShellRegex,
  parseFallback,
} from './regex-fallback';

export {
  detectFramework,
  detectFrameworkFromImports,
  FRAMEWORK_SIGNATURES,
} from './framework-detector';
export type { DetectedFramework, FrameworkInfo } from './framework-detector';

export {
  computeFileComplexity,
  computeFunctionComplexity,
  computeNestingDepth,
  computeLinesOfCode,
  analyzeFunctionMetrics,
  scoreFileQuality,
} from './complexity';

export {
  detectDeadCode,
  detectDeadCodeMulti,
  detectDeadCodeInProject,
} from './dead-code';

export {
  extractRoutes,
  extractAllRoutes,
  groupRoutesByFramework,
  printRouteTable,
} from './route-extractor';

export type {
  ASTPosition,
  ASTRange,
  ASTImport,
  ASTExport,
  ASTFunction,
  ASTClass,
  ASTInterface,
  ASTTypeAlias,
  ASTVariable,
  ASTCall,
  ASTHook,
  ASTField,
  ASTStruct,
  ASTEnum,
  ASTTrait,
  ASTImpl,
  ASTRoute,
  ASTComment,
  ASTDeadCode,
  ASTComplexity,
  ASTResult,
} from './types';
