import { ProjectInfo, FileInfo, DependencyGraph, TestResult, DeployReport } from '../types';
import { buildSVGFromGraph } from './svg';

export function generateHTMLReport(project: ProjectInfo, includeGraph: boolean = true): string {
  const graph = project.graph || { nodes: [], edges: [] };
  const svgGraph = includeGraph ? buildSVGFromGraph(graph, { width: 1000, height: 600, fontSize: 11 }) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(project.name)} - Shadow Analysis Report</title>
<style>
:root {
  --bg: #1e1e2e;
  --surface: #313244;
  --overlay: #45475a;
  --text: #cdd6f4;
  --subtext: #a6adc8;
  --accent: #89b4fa;
  --green: #a6e3a1;
  --yellow: #f9e2af;
  --red: #f38ba8;
  --purple: #cba6f7;
  --teal: #94e2d5;
  --peach: #fab387;
  --mauve: #cba6f7;
  --blue: #89b4fa;
  --radius: 8px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace; background: var(--bg); color: var(--text); padding: 40px 60px; line-height: 1.6; }
h1 { font-size: 2rem; color: var(--accent); margin-bottom: 0.25rem; }
h2 { font-size: 1.3rem; color: var(--teal); margin: 2rem 0 1rem; border-bottom: 2px solid var(--overlay); padding-bottom: 0.5rem; }
h3 { font-size: 1rem; color: var(--purple); margin: 1.2rem 0 0.5rem; }
.subtitle { color: var(--subtext); font-size: 0.9rem; margin-bottom: 2rem; }
.card { background: var(--surface); border-radius: var(--radius); padding: 20px; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat { background: var(--surface); border-radius: var(--radius); padding: 16px; text-align: center; }
.stat-value { font-size: 2rem; font-weight: bold; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--subtext); margin-top: 4px; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: bold; margin: 2px; }
.badge-file { background: var(--blue); color: #1e1e2e; }
.badge-env { background: var(--yellow); color: #1e1e2e; }
.badge-ext { background: var(--red); color: #fff; }
.badge-func { background: var(--purple); color: #1e1e2e; }
table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--overlay); }
th { color: var(--subtext); font-weight: normal; font-size: 0.8rem; text-transform: uppercase; }
tr:hover { background: var(--overlay); }
.file-list { max-height: 400px; overflow-y: auto; }
.file-item { padding: 8px 12px; border-left: 3px solid var(--blue); margin-bottom: 4px; background: var(--surface); border-radius: 0 var(--radius) var(--radius) 0; display: flex; justify-content: space-between; }
.file-path { color: var(--text); }
.file-lang { color: var(--subtext); font-size: 0.8rem; }
.graph-container { text-align: center; overflow-x: auto; padding: 1rem; }
.graph-container svg { max-width: 100%; height: auto; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; margin: 2px; background: var(--overlay); color: var(--subtext); }
.pass { color: var(--green); }
.fail { color: var(--red); }
.warn { color: var(--yellow); }
footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--overlay); color: var(--subtext); font-size: 0.8rem; text-align: center; }
@media (max-width: 768px) {
  body { padding: 20px 24px; }
  .stats { grid-template-columns: repeat(2, 1fr); }
}
</style>
</head>
<body>
<h1>${escapeHTML(project.name)}</h1>
<p class="subtitle">Shadow Analysis Report — ${escapeHTML(project.language)} project</p>

<div class="stats">
  <div class="stat"><div class="stat-value">${project.totalFiles}</div><div class="stat-label">Files</div></div>
  <div class="stat"><div class="stat-value">${project.envVars.length}</div><div class="stat-label">Env Vars</div></div>
  <div class="stat"><div class="stat-value">${project.externalAPIs.length}</div><div class="stat-label">External APIs</div></div>
  <div class="stat"><div class="stat-value">${project.entryPoints.length}</div><div class="stat-label">Entry Points</div></div>
</div>

<div class="card">
  <h2>Summary</h2>
  <p>${escapeHTML(project.summary)}</p>
  <p style="margin-top: 0.8rem;">
    <span class="badge badge-file">${project.language}</span>
    <span class="badge badge-func">${project.files.reduce((sum, f) => sum + f.functions.length, 0)} functions</span>
    <span class="badge badge-func">${project.files.reduce((sum, f) => sum + f.classes.length, 0)} classes</span>
  </p>
</div>

${generateFileTableHTML(project)}

${project.entryPoints.length > 0 ? generateEntryPointsHTML(project) : ''}

${project.envVars.length > 0 ? generateEnvVarsHTML(project) : ''}

${project.externalAPIs.length > 0 ? generateExternalAPIsHTML(project) : ''}

${svgGraph ? `<div class="card">
  <h2>Dependency Graph</h2>
  <div class="graph-container">${svgGraph}</div>
</div>` : ''}

<footer>
  Generated by Shadow CLI v0.1.0 — ${new Date().toISOString().split('T')[0]}
</footer>

</body>
</html>`;
}

function generateFileTableHTML(project: ProjectInfo): string {
  if (project.files.length === 0) return '';
  const rows = project.files.slice(0, 50).map((f) => `
    <tr>
      <td><code>${escapeHTML(f.path)}</code></td>
      <td>${escapeHTML(f.language)}</td>
      <td>${f.functions.length} fn / ${f.classes.length} cls</td>
      <td>${escapeHTML(f.purpose || '-')}</td>
    </tr>`).join('');

  const overflowNote = project.files.length > 50
    ? `<p style="color: var(--subtext); margin-top: 0.5rem; font-size: 0.8rem;">Showing 50 of ${project.files.length} files</p>`
    : '';

  return `<div class="card">
  <h2>Files</h2>
  <div class="file-list">
    <table>
      <thead><tr><th>Path</th><th>Language</th><th>Contents</th><th>Purpose</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  ${overflowNote}
</div>`;
}

function generateEntryPointsHTML(project: ProjectInfo): string {
  const items = project.entryPoints.map((ep) => `<li><code>${escapeHTML(ep)}</code></li>`).join('');
  return `<div class="card">
  <h2>Entry Points</h2>
  <ul style="list-style: none; padding: 0;">${items}</ul>
</div>`;
}

function generateEnvVarsHTML(project: ProjectInfo): string {
  const items = project.envVars.map((v) =>
    `<span class="badge badge-env">${escapeHTML(v)}</span>`
  ).join(' ');
  return `<div class="card">
  <h2>Environment Variables</h2>
  <div style="margin-top: 0.5rem;">${items}</div>
</div>`;
}

function generateExternalAPIsHTML(project: ProjectInfo): string {
  const items = project.externalAPIs.map((api) =>
    `<span class="badge badge-ext">${escapeHTML(api)}</span>`
  ).join(' ');
  return `<div class="card">
  <h2>External APIs</h2>
  <div style="margin-top: 0.5rem;">${items}</div>
</div>`;
}

export function generateTestReportHTML(result: TestResult): string {
  const passPercent = result.total > 0 ? Math.round((result.passed / result.total) * 100) : 0;
  const passColor = passPercent >= 90 ? 'var(--green)' : passPercent >= 70 ? 'var(--yellow)' : 'var(--red)';

  const failureRows = result.failures.map((f) => `
    <tr>
      <td>${escapeHTML(f.name)}</td>
      <td>${escapeHTML(f.file)}</td>
      <td>${f.line}</td>
      <td style="color: var(--red);">${escapeHTML(f.error)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Test Results - Shadow</title>
<style>
:root {
  --bg: #1e1e2e; --surface: #313244; --overlay: #45475a;
  --text: #cdd6f4; --subtext: #a6adc8; --green: #a6e3a1;
  --yellow: #f9e2af; --red: #f38ba8; --blue: #89b4fa;
  --radius: 8px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: monospace; background: var(--bg); color: var(--text); padding: 40px 60px; }
h1 { color: var(--blue); }
.card { background: var(--surface); border-radius: var(--radius); padding: 20px; margin-bottom: 1.5rem; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat { background: var(--surface); border-radius: var(--radius); padding: 16px; text-align: center; }
.stat-value { font-size: 2rem; font-weight: bold; }
.stat-label { font-size: 0.8rem; color: var(--subtext); }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--overlay); text-align: left; }
th { color: var(--subtext); font-size: 0.8rem; }
footer { margin-top: 2rem; color: var(--subtext); text-align: center; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Test Results</h1>
<div class="stats">
  <div class="stat"><div class="stat-value" style="color: var(--green);">${result.passed}</div><div class="stat-label">Passed</div></div>
  <div class="stat"><div class="stat-value" style="color: var(--red);">${result.failed}</div><div class="stat-label">Failed</div></div>
  <div class="stat"><div class="stat-value" style="color: var(--yellow);">${result.skipped}</div><div class="stat-label">Skipped</div></div>
  <div class="stat"><div class="stat-value" style="color: ${passColor};">${passPercent}%</div><div class="stat-label">Pass Rate</div></div>
</div>
${result.failures.length > 0 ? `<div class="card"><h2>Failures</h2><table><thead><tr><th>Test</th><th>File</th><th>Line</th><th>Error</th></tr></thead><tbody>${failureRows}</tbody></table></div>` : ''}
<footer>Generated by Shadow CLI</footer>
</body>
</html>`;
}

export function generateDeployReportHTML(report: DeployReport): string {
  const checkRows = report.checks.map((c) => {
    const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '⚠';
    const color = c.status === 'pass' ? 'var(--green)' : c.status === 'fail' ? 'var(--red)' : 'var(--yellow)';
    return `<tr><td style="color: ${color};">${icon}</td><td>${escapeHTML(c.name)}</td><td>${escapeHTML(c.message)}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Deploy Report - Shadow</title>
<style>
:root {
  --bg: #1e1e2e; --surface: #313244; --overlay: #45475a;
  --text: #cdd6f4; --green: #a6e3a1; --yellow: #f9e2af; --red: #f38ba8; --blue: #89b4fa;
  --radius: 8px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: monospace; background: var(--bg); color: var(--text); padding: 40px 60px; }
h1 { color: var(--blue); }
.result-banner { padding: 16px; border-radius: var(--radius); margin-bottom: 1.5rem; font-weight: bold; font-size: 1.1rem; }
.pass-banner { background: rgba(166,227,161,0.15); color: var(--green); border: 1px solid var(--green); }
.fail-banner { background: rgba(243,139,168,0.15); color: var(--red); border: 1px solid var(--red); }
.card { background: var(--surface); border-radius: var(--radius); padding: 20px; margin-bottom: 1.5rem; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 8px 12px; border-bottom: 1px solid var(--overlay); text-align: left; }
footer { margin-top: 2rem; color: var(--subtext); text-align: center; font-size: 0.8rem; }
</style>
</head>
<body>
<h1>Deploy Report</h1>
<div class="result-banner ${report.passed ? 'pass-banner' : 'fail-banner'}">
  ${report.passed ? '✓ All checks passed' : '✗ Some checks failed'} for target: ${escapeHTML(report.target)}
</div>
<div class="card">
  <h2>Checks</h2>
  <table><thead><tr><th></th><th>Check</th><th>Message</th></tr></thead><tbody>${checkRows}</tbody></table>
</div>
<footer>Generated by Shadow CLI</footer>
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
