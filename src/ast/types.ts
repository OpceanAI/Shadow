export interface ASTPosition {
  line: number;
  column: number;
}

export interface ASTRange {
  start: ASTPosition;
  end: ASTPosition;
}

export interface ASTImport {
  name: string;
  source: string;
  alias?: string;
  type: 'default' | 'named' | 'namespace' | 'require';
  range: ASTRange;
}

export interface ASTExport {
  name: string;
  kind: 'default' | 'named' | 'type' | 'reexport';
  source?: string;
  range: ASTRange;
}

export interface ASTFunction {
  name: string;
  params: string[];
  returnType?: string;
  async: boolean;
  exported: boolean;
  decorators: string[];
  docstring?: string;
  range: ASTRange;
  bodyStart: number;
  bodyEnd: number;
}

export interface ASTClass {
  name: string;
  superClass?: string;
  implements: string[];
  exported: boolean;
  decorators: string[];
  methods: string[];
  range: ASTRange;
}

export interface ASTInterface {
  name: string;
  extends: string[];
  exported: boolean;
  range: ASTRange;
}

export interface ASTTypeAlias {
  name: string;
  type: string;
  exported: boolean;
  range: ASTRange;
}

export interface ASTVariable {
  name: string;
  kind: 'const' | 'let' | 'var';
  exported: boolean;
  range: ASTRange;
}

export interface ASTCall {
  name: string;
  callee: string;
  args: number;
  range: ASTRange;
}

export interface ASTHook {
  name: string;
  callee: string;
  range: ASTRange;
}

export interface ASTField {
  name: string;
  type?: string;
  range: ASTRange;
}

export interface ASTStruct {
  name: string;
  fields: ASTField[];
  exported: boolean;
  range: ASTRange;
}

export interface ASTEnum {
  name: string;
  variants: string[];
  exported: boolean;
  range: ASTRange;
}

export interface ASTTrait {
  name: string;
  methods: string[];
  exported: boolean;
  range: ASTRange;
}

export interface ASTImpl {
  type: string;
  trait?: string;
  methods: string[];
  range: ASTRange;
}

export interface ASTRoute {
  path: string;
  method: string;
  handler: string;
  framework: string;
  file: string;
  line: number;
}

export interface ASTComment {
  text: string;
  kind: 'line' | 'block' | 'doc';
  range: ASTRange;
}

export interface ASTDeadCode {
  unusedImports: string[];
  unusedFunctions: string[];
  unusedVariables: string[];
  uncalledFunctions: string[];
}

export interface ASTComplexity {
  cyclomaticComplexity: number;
  linesOfCode: number;
  nestingDepth: number;
  functionLength: number;
  parameterCount: number;
}

export interface ASTResult {
  language: string;
  filePath: string;
  imports: ASTImport[];
  exports: ASTExport[];
  functions: ASTFunction[];
  classes: ASTClass[];
  variables: ASTVariable[];
  interfaces: ASTInterface[];
  types: ASTTypeAlias[];
  calls: ASTCall[];
  hooks: ASTHook[];
  structs: ASTStruct[];
  enums: ASTEnum[];
  traits: ASTTrait[];
  impls: ASTImpl[];
  routes: ASTRoute[];
  comments: ASTComment[];
  complexity: ASTComplexity;
  deadCode: ASTDeadCode;
  framework?: string;
  parseTime: number;
}
