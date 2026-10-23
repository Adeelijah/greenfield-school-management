// Offline exporter only. No credentials, driver, database or SQL execution.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStagingReportInstallationReview } from './lib/report-card-staging-installation-review.mjs';

if (process.argv.length !== 2) throw Error('This fixed-target exporter takes no arguments');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const changedSource = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src', 'scripts/lib', 'docs/staging',
  'scripts/report-card-staging-review-export.mjs'], { cwd: root, encoding: 'utf8' });
if (changedSource.trim()) throw Error('Reviewed source differs from HEAD; preserve it and reconcile before exporting');
const target = JSON.parse(readFileSync(join(root, 'docs/staging/GREENFIELD_STAGING_TARGET.review.json'), 'utf8'));
if (target.applicationEnabled !== false || target.schoolRecordStatus !== 'planned-not-created' ||
  target.roleProvisioningStatus !== 'absent-managed-bootstrap-review') throw Error('Target review state changed');
const result = buildStagingReportInstallationReview({ ...target, sourceCommit, baseline: 'reconciled-semantic-0000' });
const parent = join(root, 'recovery-artifacts');
mkdirSync(parent, { recursive: true });
const directory = join(parent, 'report-card-staging-review-' + sourceCommit.slice(0, 12));
// Exclusive directory and file creation: never overwrite an earlier review.
mkdirSync(directory);
const sqlPath = join(directory, 'installation.review.sql');
const manifestPath = join(directory, 'manifest.review.json');
const { sql, ...manifest } = result;
writeFileSync(sqlPath, sql, { flag: 'wx' });
writeFileSync(manifestPath, JSON.stringify({ ...manifest, projectRef: target.projectRef,
  roleAdministration: target.roleAdministration, finalPrimaryYear: target.finalPrimaryYear,
  schoolRowIncluded: false, applicationEnabled: false, databaseExecutionPerformed: false }, null, 2) + '\n', { flag: 'wx' });
process.stdout.write('Offline review files created:\n' + sqlPath + '\n' + manifestPath + '\nREVIEW ONLY: do not execute this candidate before target review and authorization.\n');
