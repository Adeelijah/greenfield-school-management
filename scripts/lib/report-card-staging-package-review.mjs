// Pure review composition. This module cannot connect, install or execute SQL.
import { createHash } from 'node:crypto';
import { stagingReportSecurityPlan } from './report-card-staging-security-plan.mjs';

const digest = text => createHash('sha256').update(text).digest('hex');
const normalize = text => {
  if (typeof text !== 'string' || !text.trim() || text.includes('\0')) throw Error('Missing review source');
  return text.replaceAll('\r\n', '\n').trim();
};

/** Inputs must be the reviewed dependency/guard artifacts and actual staging
 * proposal metadata output at sourceCommit. Hashes identify the supplied bytes;
 * they do not attest installed catalogs or establish authorization to apply.
 */
export function assembleStagingReportReview(config, sources) {
  const policy = stagingReportSecurityPlan(config);
  if (config.baseline !== 'reconciled-semantic-0000') throw Error('Explicit reconciled baseline required');
  const dependencies = normalize(sources?.dependencies), guards = normalize(sources?.guards);
  if (!Array.isArray(sources.proposalStatements) || sources.proposalStatements.length === 0 ||
    sources.proposalStatements.some(s => typeof s !== 'string' || !/^(CREATE TYPE public\.|CREATE TABLE public\.|CREATE (?:UNIQUE )?INDEX |ALTER TABLE public\.)/.test(s))) throw Error('Reviewed proposal statements required');
  const proposal = sources.proposalStatements.map(normalize).map(s => s.replace(/;$/, '') + ';').join('\n\n');
  if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im.test(dependencies) || /\brc_it_[a-f0-9]/.test(dependencies + proposal + guards)) throw Error('Unexpected review namespace or transaction');
  const begin = guards.indexOf('\nBEGIN;\n');
  if (begin < 0 || !guards.endsWith('\nCOMMIT;')) throw Error('Expected bounded coordinated guard transaction');
  const guardBody = guards.slice(begin + '\nBEGIN;\n'.length, -'\nCOMMIT;'.length).trim();
  if (/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/im.test(guardBody)) throw Error('Nested review transaction');
  const phases = [
    ['dependencies', dependencies], ['proposal', proposal], ['guards', guardBody],
    ['policy', policy.statements.map(s => s + ';').join('\n\n')],
  ];
  const sql = '-- REVIEW ONLY: unexecuted, not a deployment authorization.\n' +
    '-- Source: ' + policy.sourceCommit + '; fixed school: ' + policy.schoolId + '\n' +
    'BEGIN;\n\n' + phases.map(([name, body]) => '-- Phase: ' + name + '\n' + body).join('\n\n') + '\n\nCOMMIT;\n';
  return Object.freeze({ status: 'review-only', sourceCommit: policy.sourceCommit, schoolId: policy.schoolId,
    baseline: config.baseline, sql, sha256: digest(sql),
    phases: Object.freeze(phases.map(([name, body]) => Object.freeze({ name, sha256: digest(body) }))),
    requiresCatalogAndPrivilegeAudit: true, requiresAuthorizedIsolatedRehearsal: true });
}
