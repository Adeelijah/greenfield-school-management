// Fixed offline allowlist. No env loading, dev server, database, or network command.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = [
  'scripts/assessment-disposable-schema.test.mjs',
  'src/components/academics/class-structure.test.ts',
  'src/components/students/academic-progression.test.ts',
  'src/components/students/class-assignment-validation.test.ts',
  'src/components/students/promotion-eligibility.test.ts',
  'src/components/students/promotion-validation.test.ts',
  'src/components/students/student-exit-validation.test.ts',
  'src/db/lifecycle-schema.test.ts',
  'src/db/report-cards-schema.proposal.test.ts',
  'src/db/academic-assessments-schema.proposal.test.ts',
  'src/lib/students/lifecycle-authorization.test.ts',
  'src/lib/students/lifecycle-commands.test.ts',
  'src/lib/students/lifecycle-memory-adapter.test.ts',
  'src/lib/attendance/attendance.test.ts',
  'src/lib/academics/assignments.test.ts',
  'src/lib/academics/subjects.test.ts',
  'src/components/greenfield-dropdown-behavior.test.ts',
  'src/lib/admissions/admissions.test.ts',
  'src/lib/students/registration.test.ts',
  'src/lib/academics/calendar-assessments.test.ts',
  'src/lib/academics/assessment-persistence-policy.test.ts',
  'src/lib/academics/report-cards.test.ts',
  'src/lib/academics/report-card-workflow.test.ts',
  'src/lib/academics/report-card-preflight.test.ts',
  'src/lib/academics/report-card-persistence-policy.test.ts',
  'src/lib/academics/report-card-memory-adapter.test.ts',
  'src/lib/academics/report-card-snapshot-readiness.test.ts',
  'src/lib/academics/report-card-canonical-snapshot.test.ts',
  'src/lib/academics/report-card-academic-payload.test.ts',
  'src/lib/academics/report-card-trusted-source.test.ts',
  'src/lib/academics/report-card-authoritative-read.test.ts',
  'src/lib/academics/report-card-postgres-disposable-read-adapter.test.ts',
  'src/lib/academics/report-card-postgres-disposable-trusted-transaction.test.ts',
  'src/lib/academics/report-card-persisted-model-map.test.ts',
  'src/lib/academics/report-card-transaction-port.test.ts',
  'src/components/greenfield-date-picker-layout.test.ts',
];

function check(label, command, args) {
  process.stdout.write(`Checking ${label}\n`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}`);
}

check('TypeScript', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
check('ESLint source', process.execPath, ['node_modules/eslint/bin/eslint.js', 'src']);
check('allowlisted pure unit tests', process.execPath, ['--experimental-strip-types', '--test', ...tests]);
check('tracked Git whitespace', 'git', ['diff', '--check']);
process.stdout.write('Offline checks passed. Git diff --check does not inspect untracked files.\n');
