// Offline review assembly only: fixed repository inputs, no apply entrypoint.
import { readFileSync } from 'node:fs';
import { stagingReportProposalStatements } from './report-card-staging-proposal-review.mjs';
import { assembleStagingReportReview } from './report-card-staging-package-review.mjs';

/** Source revision must identify this checkout; real catalog compatibility,
 * effective privileges and explicit isolated-target authorization are separate.
 * The returned SQL is a review candidate, never an instruction to apply it.
 */
export function buildStagingReportInstallationReview(config) {
  const read = name => readFileSync(new URL('../../docs/staging/' + name, import.meta.url), 'utf8');
  return assembleStagingReportReview(config, {
    dependencies: read('REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql'),
    proposalStatements: stagingReportProposalStatements(),
    guards: read('REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql'),
  });
}
