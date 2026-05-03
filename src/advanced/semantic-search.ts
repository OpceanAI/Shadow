import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface SearchDocument {
  file: string;
  content: string;
  tokens: Map<string, number>;
  tfIdf: Map<string, number>;
}

export interface SearchResult {
  file: string;
  snippet: string;
  line: number;
  score: number;
  matchType: 'semantic' | 'regex' | 'fuzzy';
}

export interface TfIdfIndex {
  documents: SearchDocument[];
  idf: Map<string, number>;
}

export class SemanticSearchEngine {
  private index: TfIdfIndex = { documents: [], idf: new Map() };

  indexProject(projectPath?: string): void {
    this.index = { documents: [], idf: new Map() };
    const config = loadConfig(projectPath);
    const analyzer = new Analyzer(config, projectPath);
    const project = analyzer.analyzeProject();

    for (const file of project.files) {
      try {
        const content = readFile(file.path);
        const tokens = this.tokenize(content);
        this.index.documents.push({
          file: file.path,
          content,
          tokens,
          tfIdf: new Map(),
        });
      } catch {
        // skip unreadable files
      }
    }

    this.computeIdf();
    this.computeTfIdf();
  }

  private tokenize(text: string): Map<string, number> {
    const tokens = new Map<string, number>();
    const words = text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9_$]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    for (const word of words) {
      tokens.set(word, (tokens.get(word) || 0) + 1);
    }

    // Add camelCase and snake_case splits
    for (const word of words) {
      const parts = word.split(/(?=[A-Z])|_/).filter((p) => p.length > 1);
      for (const part of parts) {
        tokens.set(part.toLowerCase(), (tokens.get(part.toLowerCase()) || 0) + 1);
      }
    }

    return tokens;
  }

  private computeIdf(): void {
    const N = this.index.documents.length;
    const df = new Map<string, number>();

    for (const doc of this.index.documents) {
      const seen = new Set<string>();
      for (const token of doc.tokens.keys()) {
        if (!seen.has(token)) {
          seen.add(token);
          df.set(token, (df.get(token) || 0) + 1);
        }
      }
    }

    for (const [token, count] of df.entries()) {
      this.index.idf.set(token, Math.log((N + 1) / (count + 1)) + 1);
    }
  }

  private computeTfIdf(): void {
    for (const doc of this.index.documents) {
      let maxTf = 0;
      for (const count of doc.tokens.values()) {
        if (count > maxTf) maxTf = count;
      }
      for (const [token, count] of doc.tokens.entries()) {
        const tf = count / (maxTf || 1);
        const idf = this.index.idf.get(token) || 0;
        doc.tfIdf.set(token, tf * idf);
      }
    }
  }

  search(query: string, options?: { regex?: boolean; fuzzy?: boolean; maxResults?: number }): SearchResult[] {
    const results: SearchResult[] = [];
    const maxResults = options?.maxResults || 20;

    if (options?.regex) {
      this.searchRegex(query, results);
    } else if (options?.fuzzy) {
      this.searchFuzzy(query, results);
    } else {
      this.searchSemantic(query, results);
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, maxResults);
  }

  private searchSemantic(query: string, results: SearchResult[]): void {
    const queryTokens = this.tokenize(query);
    const queryVec = new Map<string, number>();

    let maxTf = 0;
    for (const count of queryTokens.values()) {
      if (count > maxTf) maxTf = count;
    }
    for (const [token, count] of queryTokens.entries()) {
      const tf = count / (maxTf || 1);
      const idf = this.index.idf.get(token) || 0;
      queryVec.set(token, tf * idf);
    }

    for (const doc of this.index.documents) {
      const score = this.cosineSimilarity(queryVec, doc.tfIdf);
      if (score > 0) {
        const snippet = this.extractSnippet(doc.content, queryTokens);
        results.push({
          file: doc.file,
          snippet,
          line: 0,
          score,
          matchType: 'semantic',
        });
      }
    }
  }

  private cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const [token, valA] of a.entries()) {
      const valB = b.get(token) || 0;
      dotProduct += valA * valB;
      normA += valA * valA;
    }

    for (const valB of b.values()) {
      normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private searchRegex(query: string, results: SearchResult[]): void {
    let regex: RegExp;
    try {
      regex = new RegExp(query, 'gi');
    } catch {
      regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    }

    for (const doc of this.index.documents) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(doc.content)) !== null) {
        const lineNum = doc.content.substring(0, match.index).split('\n').length;
        const lines = doc.content.split('\n');
        const lineIdx = lineNum - 1;
        const snippet = lines.slice(Math.max(0, lineIdx - 1), lineIdx + 2).join('\n');

        results.push({
          file: doc.file,
          snippet,
          line: lineNum,
          score: 0.5,
          matchType: 'regex',
        });
      }
    }
  }

  private searchFuzzy(query: string, results: SearchResult[]): void {
    const queryLower = query.toLowerCase();
    for (const doc of this.index.documents) {
      const lines = doc.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const similarity = this.fuzzyMatch(queryLower, line.toLowerCase());
        if (similarity > 0.4) {
          const snippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
          results.push({
            file: doc.file,
            snippet,
            line: i + 1,
            score: similarity,
            matchType: 'fuzzy',
          });
        }
      }
    }
  }

  private fuzzyMatch(pattern: string, text: string): number {
    const patternLen = pattern.length;
    const textLen = text.length;

    if (patternLen === 0) return 1;
    if (textLen === 0) return 0;

    const d: number[][] = Array.from({ length: patternLen + 1 }, () =>
      Array.from({ length: textLen + 1 }, () => 0),
    );

    for (let i = 0; i <= patternLen; i++) d[i][0] = i;
    for (let j = 0; j <= textLen; j++) d[0][j] = j;

    for (let i = 1; i <= patternLen; i++) {
      for (let j = 1; j <= textLen; j++) {
        const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,
          d[i][j - 1] + 1,
          d[i - 1][j - 1] + cost,
        );
      }
    }

    const maxLen = Math.max(patternLen, textLen);
    return 1 - d[patternLen][textLen] / maxLen;
  }

  private extractSnippet(content: string, queryTokens: Map<string, number>): string {
    const lines = content.split('\n');
    const queryWords = Array.from(queryTokens.keys());

    let bestLine = 0;
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (lineLower.includes(word)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestLine = i;
      }
    }

    const start = Math.max(0, bestLine - 1);
    const end = Math.min(lines.length, bestLine + 2);
    return lines.slice(start, end).join('\n');
  }

  getIndexStats(): { documents: number; vocabularySize: number; avgDocLength: number } {
    const vocab = new Set<string>();
    let totalTokens = 0;
    for (const doc of this.index.documents) {
      for (const token of doc.tokens.keys()) {
        vocab.add(token);
      }
      for (const count of doc.tokens.values()) {
        totalTokens += count;
      }
    }
    return {
      documents: this.index.documents.length,
      vocabularySize: vocab.size,
      avgDocLength: this.index.documents.length > 0
        ? Math.round(totalTokens / this.index.documents.length)
        : 0,
    };
  }
}

export function printSemanticSearch(query: string, options?: { regex?: boolean; fuzzy?: boolean }): void {
  const engine = new SemanticSearchEngine();
  engine.indexProject();

  console.log(chalk.bold.blue('\n[shadow semantic-search]\n'));
  console.log(chalk.dim(`Query: "${query}"`));

  if (options?.regex) console.log(chalk.dim('Mode: regex'));
  else if (options?.fuzzy) console.log(chalk.dim('Mode: fuzzy'));
  else console.log(chalk.dim('Mode: semantic (TF-IDF)'));

  console.log();

  const results = engine.search(query, {
    regex: options?.regex,
    fuzzy: options?.fuzzy,
  });

  if (results.length === 0) {
    console.log(chalk.yellow('No results found.'));
  } else {
    for (const r of results) {
      const typeColor = r.matchType === 'semantic'
        ? chalk.cyan
        : r.matchType === 'regex'
          ? chalk.magenta
          : chalk.yellow;
      console.log(`  ${typeColor(`[${r.matchType}]`)} ${chalk.white(r.file)} ${chalk.dim(`(score: ${r.score.toFixed(3)})`)}`);
      if (r.line > 0) console.log(chalk.dim(`    line ${r.line}`));
      const snippetLines = r.snippet.split('\n');
      for (const sl of snippetLines) {
        console.log(chalk.dim(`    ${sl.trim().slice(0, 100)}`));
      }
      console.log();
    }
  }
  console.log(chalk.dim(`${results.length} results\n`));
}
