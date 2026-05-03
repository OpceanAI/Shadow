declare module 'js-yaml' {
  export function load(input: string, options?: Record<string, unknown>): unknown;
  export function dump(obj: unknown, options?: Record<string, unknown>): string;
  export function safeLoad(input: string, options?: Record<string, unknown>): unknown;
  export function safeDump(obj: unknown, options?: Record<string, unknown>): string;
  export class YAMLException extends Error {
    constructor(reason?: string, mark?: unknown);
    reason: string;
  }
  export const CORE_SCHEMA: unknown;
  export const DEFAULT_SCHEMA: unknown;
  export const JSON_SCHEMA: unknown;
}
