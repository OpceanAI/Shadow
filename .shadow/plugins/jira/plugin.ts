import { definePlugin, createCommand, createPluginLogger } from '../../../src/plugin/sdk';

export default definePlugin({
  name: 'jira',
  version: '0.1.0',
  description: 'Jira integration for issue tracking',
  hooks: {
    async onInit() {
      const logger = createPluginLogger('jira');
      logger.info('Jira plugin initialized (stub)');
      logger.info('Configure JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable.');
    },
    async onCommit(message) {
      const logger = createPluginLogger('jira');
      const issueKey = extractJiraIssueKey(message);
      if (issueKey) {
        logger.debug(`Commit references Jira issue: ${issueKey}`);
      }
    },
  },
  commands: [
    createCommand('issues', 'List Jira issues for the current project', {
      options: [
        { flags: '--assignee <user>', description: 'Filter by assignee' },
        { flags: '--status <status>', description: 'Filter by status' },
        { flags: '--project <key>', description: 'Jira project key' },
        { flags: '--json', description: 'JSON output' },
      ],
      action(ctx) {
        const logger = createPluginLogger('jira');
        const jiraUrl = process.env.JIRA_URL;
        const jiraEmail = process.env.JIRA_EMAIL;
        const jiraToken = process.env.JIRA_API_TOKEN;

        if (!jiraUrl || !jiraEmail || !jiraToken) {
          logger.error('Jira credentials not configured.');
          logger.info('Set JIRA_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.');
          return;
        }

        const project = (ctx.options.project as string) || process.env.JIRA_PROJECT || '';
        const assignee = ctx.options.assignee as string | undefined;
        const status = ctx.options.status as string | undefined;

        logger.info(`Would fetch ${project ? project + ' ' : ''}issues from ${jiraUrl}`);
        if (assignee) logger.info(`  Assignee: ${assignee}`);
        if (status) logger.info(`  Status: ${status}`);
        logger.warn('Full Jira API integration is not yet implemented.');

        if (ctx.options.json) {
          console.log(JSON.stringify({
            stub: true,
            plugin: 'jira',
            issues: [],
            message: 'Jira integration stub - configure credentials to enable',
          }));
        } else {
          logger.success('No issues found (stub).');
        }
      },
    }),
    createCommand('create-issue', 'Create a Jira issue', {
      options: [
        { flags: '--title <title>', description: 'Issue title' },
        { flags: '--description <desc>', description: 'Issue description' },
        { flags: '--type <type>', description: 'Issue type', defaultValue: 'Bug' },
        { flags: '--project <key>', description: 'Jira project key' },
      ],
      action(ctx) {
        const logger = createPluginLogger('jira');
        const title = ctx.options.title as string | undefined;
        if (!title) {
          logger.error('Issue title is required. Use --title.');
          return;
        }
        logger.info(`Would create ${ctx.options.type || 'Bug'} issue: "${title}"`);
        logger.warn('Full Jira API integration is not yet implemented.');
        logger.success('Stub issue created.');
      },
    }),
  ],
});

function extractJiraIssueKey(message: string): string | null {
  const match = message.match(/\b([A-Z]{2,10}-\d+)\b/);
  return match ? match[1] : null;
}
