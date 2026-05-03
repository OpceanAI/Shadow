import { simpleGit, SimpleGit, LogResult, DiffResult } from 'simple-git';
import { readFile } from '../utils/fs';
import { DiffSummary } from '../types';

export class GitService {
  private git: SimpleGit;

  constructor(repoPath: string = process.cwd()) {
    this.git = simpleGit(repoPath);
  }

  async isGitRepo(): Promise<boolean> {
    try {
      await this.git.status();
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('Warning: Not a git repository or git error:', message);
      return false;
    }
  }

  async getDiff(from?: string, to?: string): Promise<DiffSummary> {
    let diff: string;
    if (from && to) {
      diff = await this.git.diff([`${from}..${to}`]);
    } else {
      diff = await this.git.diff();
    }

    const filesChanged = diff
      .split('\n')
      .filter((l) => l.startsWith('diff --git'))
      .map((l) => l.split(' ')[2].replace('a/', ''));

    const additions = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
    const deletions = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

    return {
      from: from || 'HEAD',
      to: to || 'working tree',
      filesChanged,
      additions,
      deletions,
      behavioralChanges: [],
      regressionRisks: [],
      areasToRetest: filesChanged,
    };
  }

  async getStatus(): Promise<string> {
    const status = await this.git.status();
    return [
      `Branch: ${status.current}`,
      `Modified: ${status.modified.length} files`,
      `Added: ${status.created.length} files`,
      `Deleted: ${status.deleted.length} files`,
    ].join('\n');
  }

  async generateCommitMessage(): Promise<string> {
    const diff = await this.git.diff(['--staged']);
    if (!diff) return 'chore: empty commit';

    const filesChanged = diff
      .split('\n')
      .filter((l) => l.startsWith('diff --git'))
      .map((l) => l.split(' ')[2].replace('a/', ''));

    const types: Record<string, string> = {
      test: 'test',
      spec: 'test',
      style: 'style',
      css: 'style',
      config: 'chore',
      doc: 'docs',
      readme: 'docs',
    };

    const mainFile = filesChanged[0] || '';
    const fileDir = mainFile.split('/')[0] || '';
    const type = Object.entries(types).find(([k]) => mainFile.includes(k))?.[1] || 'feat';

    const scope = fileDir !== mainFile ? `(${fileDir})` : '';
    return `${type}${scope}: update ${filesChanged.length} file(s)`;
  }

  async getHistory(limit: number = 20): Promise<string> {
    const log = await this.git.log({ maxCount: limit });
    return log.all
      .map((commit) => `${commit.hash.slice(0, 7)} ${commit.message}`)
      .join('\n');
  }
}
