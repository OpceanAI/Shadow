import { Command } from 'commander';
import { GitService } from '../core/git';
import { loadConfig } from '../core/config';
import { AIProviderService } from '../core/ai-provider';
import { Analyzer } from '../core/analyzer';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function reviewCommand(program: Command): void {
  program
    .command('review')
    .description('AI code review of current changes')
    .option('--strict', 'Strict review mode (all issues)')
    .option('--focus <area>', 'Focus area: security, performance, style, bugs, all')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const git = new GitService();
      const analyzer = new Analyzer(config);

      console.log(chalk.bold.blue('\n[shadow review]\n'));

      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        const project = analyzer.analyzeProject();

        const issues: string[] = [];
        const totalFunctions = project.files.reduce((s, f) => s + f.functions.length, 0);
        const totalClasses = project.files.reduce((s, f) => s + f.classes.length, 0);
        const totalEnvVars = project.files.reduce((s, f) => s + f.envVars.length, 0);
        const totalExternalAPIs = project.files.reduce((s, f) => s + f.externalCalls.length, 0);

        issues.push(`Project: ${project.totalFiles} files, ${totalFunctions} functions, ${totalClasses} classes`);
        issues.push(`Language: ${project.language}`);
        issues.push(`Environment variables: ${totalEnvVars}`);
        issues.push(`External API calls: ${totalExternalAPIs}`);

        if (project.entryPoints.length === 0) {
          issues.push('Warning: No entry points detected');
        }

        const securityIssues: string[] = [];
        for (const file of project.files) {
          for (const v of file.envVars) {
            if (/key|secret|token|password/i.test(v)) {
              securityIssues.push(`${file.path}: Uses sensitive env var "${v}"`);
            }
          }
        }

        if (securityIssues.length > 0) {
          issues.push(`\nSecurity concerns (${securityIssues.length}):`);
          issues.push(...securityIssues);
        }

        if (options.json) {
          printJSON({ review: { issues, securityIssues, project } });
          return;
        }

        console.log(chalk.bold('Code Review Results:'));
        for (const issue of issues) {
          if (issue.startsWith('Security') || issue.includes('Warning')) {
            console.log(`  ${chalk.yellow('⚠')} ${issue}`);
          } else {
            console.log(`  ${chalk.green('•')} ${issue}`);
          }
        }
      } else {
        const status = await git.getStatus();
        const diff = await git.getDiff();
        console.log(chalk.bold('Changed files:'));
        for (const f of diff.filesChanged) {
          console.log(`  ${chalk.cyan('↳')} ${f}`);
        }
        console.log(chalk.dim(`\n  +${diff.additions} -${diff.deletions} lines`));

        if (options.focus === 'security' || options.focus === 'all' || options.strict) {
          console.log(chalk.yellow('\n  Security: Review env vars, API keys, and input validation'));
        }
        if (options.focus === 'style' || options.focus === 'all' || options.strict) {
          console.log(chalk.yellow('  Style: Check naming conventions and code organization'));
        }
        if (options.focus === 'bugs' || options.focus === 'all' || options.strict) {
          console.log(chalk.yellow('  Bugs: Review error handling and edge cases'));
        }
        if (options.focus === 'performance' || options.focus === 'all' || options.strict) {
          console.log(chalk.yellow('  Performance: Check loops, async ops, memory usage'));
        }
      }
      console.log('');
    });
}
