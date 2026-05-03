import { Command } from 'commander';
import { Analyzer } from '../core/analyzer';
import { loadConfig } from '../core/config';
import { SecurityTestGenerator } from '../core/test-security';
import { readFile } from '../utils/fs';
import { printJSON } from '../output/json';
import chalk from 'chalk';

export function securityCommand(program: Command): void {
  program
    .command('security')
    .description('SAST scanning for vulnerabilities')
    .option('--cwe <ids>', 'Filter by CWE IDs (comma-separated)')
    .option('--owasp', 'OWASP Top 10 focused checks')
    .option('--severity <level>', 'Min severity: low, medium, high, critical', 'low')
    .option('--json', 'JSON output')
    .action(async (options) => {
      const config = loadConfig();
      const analyzer = new Analyzer(config);
      const project = analyzer.analyzeProject();

      const findings: Array<{
        file: string;
        line: number;
        severity: string;
        category: string;
        description: string;
        cwe?: string;
      }> = [];

      for (const file of project.files) {
        try {
          const content = readFile(file.path);
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNum = i + 1;

            if (/eval\s*\(/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'high',
                category: 'Code Injection',
                description: 'Use of eval() can lead to code injection',
                cwe: 'CWE-95',
              });
            }

            if (/exec\s*\(/.test(line) || /execSync\s*\(/.test(line) || /spawn\s*\(/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'high',
                category: 'Command Injection',
                description: 'Command execution with potential unsanitized input',
                cwe: 'CWE-78',
              });
            }

            if (/innerHTML\s*=/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'medium',
                category: 'Cross-Site Scripting',
                description: 'innerHTML assignment may lead to XSS',
                cwe: 'CWE-79',
              });
            }

            if (/(?:password|secret|apiKey|token|API_KEY)\s*[=:]\s*['"][^'"]+['"]/.test(line) &&
                !line.includes('process.env') && !line.includes('os.environ') && !line.includes('os.getenv')) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'critical',
                category: 'Hardcoded Credentials',
                description: 'Hardcoded credential detected',
                cwe: 'CWE-798',
              });
            }

            if (/http:\/\//.test(line) && !/http:\/\/localhost/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'low',
                category: 'Insecure Transport',
                description: 'HTTP (non-HTTPS) URL detected',
                cwe: 'CWE-319',
              });
            }

            if (/(?:console\.log|console\.error|console\.warn|print|fmt\.Println)\s*\(\s*err/.test(line) ||
                /console\.(?:log|error)\s*\(\s*["']\w*(?:password|secret|token|key)['"]\s*\)/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'low',
                category: 'Sensitive Data Exposure',
                description: 'Potential logging of sensitive information',
                cwe: 'CWE-532',
              });
            }

            if (/\.innerHTML\s*=\s*['"`]/.test(line) || /\.outerHTML\s*=/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'medium',
                category: 'Cross-Site Scripting',
                description: 'Direct HTML injection possible',
                cwe: 'CWE-79',
              });
            }

            if (/dangerouslySetInnerHTML/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'high',
                category: 'Cross-Site Scripting',
                description: 'React dangerouslySetInnerHTML used',
                cwe: 'CWE-79',
              });
            }

            if (/system\s*\(/.test(line) || /popen\s*\(/.test(line)) {
              findings.push({
                file: file.path,
                line: lineNum,
                severity: 'high',
                category: 'Command Injection',
                description: 'System call execution',
                cwe: 'CWE-78',
              });
            }
          }
        } catch {
          // skip unreadable files
        }
      }

      let filteredFindings = findings;

      if (options.cwe) {
        const cweIds = options.cwe.split(',').map((s: string) => s.trim().toUpperCase());
        filteredFindings = filteredFindings.filter((f) => f.cwe && cweIds.includes(f.cwe));
      }

      if (options.owasp) {
        const owaspCWEs = ['CWE-79', 'CWE-89', 'CWE-78', 'CWE-798', 'CWE-319', 'CWE-95', 'CWE-532'];
        filteredFindings = filteredFindings.filter((f) => f.cwe && owaspCWEs.includes(f.cwe));
      }

      const severityOrder: Record<string, number> = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
      const minSeverity = severityOrder[options.severity] ?? 3;
      filteredFindings = filteredFindings.filter((f) => (severityOrder[f.severity] ?? 3) <= minSeverity);

      if (options.json) {
        printJSON({ findings: filteredFindings, total: filteredFindings.length });
        return;
      }

      console.log(chalk.bold.blue('\n[shadow security]\n'));

      if (filteredFindings.length === 0) {
        console.log(chalk.green('No vulnerabilities found.'));
      } else {
        const bySeverity: Record<string, typeof findings> = {};
        for (const f of filteredFindings) {
          (bySeverity[f.severity] = bySeverity[f.severity] || []).push(f);
        }

        for (const sev of ['critical', 'high', 'medium', 'low']) {
          const items = bySeverity[sev];
          if (!items || items.length === 0) continue;
          const color = sev === 'critical' ? chalk.red : sev === 'high' ? chalk.red : sev === 'medium' ? chalk.yellow : chalk.gray;
          console.log(color.bold(`${sev.toUpperCase()} (${items.length})`));
          for (const item of items) {
            console.log(`  ${color('⚠')} ${item.description}`);
            console.log(`    ${chalk.dim(item.file)}:${item.line} ${item.cwe ? chalk.dim(`[${item.cwe}]`) : ''}`);
          }
          console.log('');
        }

        console.log(chalk.dim(`Total: ${filteredFindings.length} finding(s)`));
      }
      console.log('');
    });
}
