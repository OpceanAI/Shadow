import { readFile, findFiles } from '../utils/fs';
import chalk from 'chalk';

export interface SimilarityPair {
  fileA: string;
  fileB: string;
  score: number;
  overlaps: string[];
}

export interface DuplicateBlock {
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  similarTo: Array<{ file: string; startLine: number; score: number }>;
}

export interface SimilarityReport {
  pairs: SimilarityPair[];
  stats: {
    totalFiles: number;
    totalComparisons: number;
    averageSimilarity: number;
    maxSimilarity: number;
    highlySimilar: number;
  };
}

export class CodeSimilarityDetector {
  private ngramSize = 5;

  analyze(projectPath?: string): SimilarityReport {
    const files = findFiles(projectPath || process.cwd(), [
      '*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java',
    ]);

    const fileContents: Array<{ path: string; content: string }> = [];
    for (const f of files) {
      try {
        const content = readFile(f);
        fileContents.push({ path: f, content });
      } catch {
        // skip
      }
    }

    const pairs: SimilarityPair[] = [];

    for (let i = 0; i < fileContents.length; i++) {
      for (let j = i + 1; j < fileContents.length; j++) {
        const score = this.jaccardSimilarity(
          fileContents[i].content,
          fileContents[j].content,
        );
        if (score > 0.1) {
          pairs.push({
            fileA: fileContents[i].path,
            fileB: fileContents[j].path,
            score,
            overlaps: this.findOverlaps(fileContents[i].content, fileContents[j].content),
          });
        }
      }
    }

    pairs.sort((a, b) => b.score - a.score);

    const scores = pairs.map((p) => p.score);
    return {
      pairs,
      stats: {
        totalFiles: fileContents.length,
        totalComparisons: pairs.length,
        averageSimilarity: scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
        maxSimilarity: scores.length > 0 ? Math.max(...scores) : 0,
        highlySimilar: pairs.filter((p) => p.score > 0.7).length,
      },
    };
  }

  private generateNGrams(text: string, n: number): Set<string> {
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const ngrams = new Set<string>();
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.substring(i, i + n));
    }
    return ngrams;
  }

  private jaccardSimilarity(textA: string, textB: string): number {
    const ngramsA = this.generateNGrams(textA, this.ngramSize);
    const ngramsB = this.generateNGrams(textB, this.ngramSize);

    if (ngramsA.size === 0 && ngramsB.size === 0) return 0;

    let intersection = 0;
    for (const ng of ngramsA) {
      if (ngramsB.has(ng)) intersection++;
    }

    const union = ngramsA.size + ngramsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private findOverlaps(textA: string, textB: string): string[] {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const overlaps: string[] = [];
    const minCommonLines = 3;

    const linesBTrimmed = linesB.map((l) => l.trim());

    let i = 0;
    while (i < linesA.length) {
      const lineA = linesA[i].trim();
      if (lineA.length < 20) {
        i++;
        continue;
      }

      const matchIdx = linesBTrimmed.indexOf(lineA);
      if (matchIdx >= 0) {
        let matchLen = 1;
        while (
          i + matchLen < linesA.length &&
          matchIdx + matchLen < linesB.length &&
          linesA[i + matchLen].trim() === linesBTrimmed[matchIdx + matchLen]
        ) {
          matchLen++;
        }
        if (matchLen >= minCommonLines) {
          overlaps.push(linesA[i].trim().slice(0, 80));
          i += matchLen;
          continue;
        }
      }
      i++;
    }

    return overlaps.slice(0, 5);
  }

  detectDuplicates(content: string): DuplicateBlock[] {
    const lines = content.split('\n');
    const blocks: DuplicateBlock[] = [];
    const minBlockSize = 5;

    const seenHashes = new Map<string, number>();

    for (let i = 0; i < lines.length - minBlockSize; i++) {
      const block = lines.slice(i, i + minBlockSize).join('\n').trim();
      if (block.length < 30) continue;

      const hash = this.simpleHash(block);
      if (seenHashes.has(hash)) {
        const prevStart = seenHashes.get(hash)!;
        const size = this.expandBlock(lines, prevStart, i, minBlockSize);
        const isDuplicate = blocks.some(
          (b) => Math.abs(b.startLine - prevStart) <= minBlockSize,
        );
        if (!isDuplicate) {
          blocks.push({
            file: '',
            startLine: i + 1,
            endLine: i + size,
            code: lines.slice(i, i + size).join('\n').slice(0, 200),
            similarTo: [{ file: '', startLine: prevStart + 1, score: 0.9 }],
          });
        }
      } else {
        seenHashes.set(hash, i);
      }
    }

    return blocks;
  }

  private simpleHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + ch;
      hash |= 0;
    }
    return String(hash);
  }

  private expandBlock(lines: string[], start1: number, start2: number, initialSize: number): number {
    let size = initialSize;
    while (
      start1 + size < lines.length &&
      start2 + size < lines.length &&
      lines[start1 + size].trim() === lines[start2 + size].trim()
    ) {
      size++;
    }
    return size;
  }
}

export function printSimilarities(): void {
  const detector = new CodeSimilarityDetector();
  const report = detector.analyze();

  console.log(chalk.bold.blue('\n[shadow similarities]\n'));
  console.log(chalk.bold('Stats:'));
  console.log(`  Files analyzed:     ${report.stats.totalFiles}`);
  console.log(`  Comparisons made:   ${report.stats.totalComparisons}`);
  console.log(`  Average similarity: ${(report.stats.averageSimilarity * 100).toFixed(1)}%`);
  console.log(`  Max similarity:     ${(report.stats.maxSimilarity * 100).toFixed(1)}%`);
  console.log(`  Highly similar:     ${report.stats.highlySimilar} pairs (>70%)`);
  console.log();

  if (report.pairs.length === 0) {
    console.log(chalk.green('No significant code similarities found.'));
  } else {
    console.log(chalk.bold('Top similar file pairs:'));
    const top = report.pairs.slice(0, 15);
    for (const pair of top) {
      const pct = (pair.score * 100).toFixed(1);
      const color = pair.score > 0.7 ? chalk.red : pair.score > 0.4 ? chalk.yellow : chalk.gray;
      console.log(`  ${color(`${pct}%`)}  ${chalk.cyan(pair.fileA)} ${chalk.dim('↔')} ${chalk.cyan(pair.fileB)}`);
      for (const overlap of pair.overlaps.slice(0, 2)) {
        console.log(chalk.dim(`         ${overlap}`));
      }
    }
  }
  console.log();
}
