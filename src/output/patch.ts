import { FixProposal } from '../types';

export function renderPatch(proposal: FixProposal): string {
  return [
    `# ${proposal.title}`,
    '',
    proposal.description,
    '',
    '```diff',
    proposal.patch,
    '```',
  ].join('\n');
}
