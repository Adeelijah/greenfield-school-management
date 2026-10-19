// Opt-in synthetic PostgreSQL read-port tests. No application env or schema.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { initialAssessment, previewSchoolId } from '../src/components/academics/calendar-assessment-fixtures.ts';
import { readAuthoritativeReport } from '../src/lib/academics/report-card-authoritative-read.ts';
import { executeTrustedDisposableReport } from '../src/lib/academics/report-card-postgres-disposable-trusted-transaction.ts';
import { disposableAuthoritativeReadPort } from '../src/lib/academics/report-card-postgres-disposable-read-adapter.ts';

const url = process.env.REPORT_CARD_TEST_DATABASE_URL;
if (!url || process.env.REPORT_CARD_TEST_CONFIRM !== 'DISPOSABLE_REPORT_CARD_TEST_ONLY') {
 console.error('SKIPPED: explicit disposable database URL and confirmation required.');
 process.exitCode = 2;
} else {
 const parsed = new URL(url);
 if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw Error('Only a local disposable test database is permitted.');
 const client = postgres(url, { max: 4, connect_timeout: 5, prepare: false, onnotice: () => {} });
 const wrap = tx => ({ unsafe: (query, parameters = []) => tx.unsafe(query, parameters.map(value => typeof value === 'string' ? client.typed(value, 25) : value)) });
 const sql = wrap(client);
 const schema = 'rc_it_' + randomBytes(8).toString('hex');
 const table = name => '"' + schema + '"."read_' + name + '"';
 const school = previewSchoolId;
 const record = { schoolId: school, studentId: 'student-amina', classId: 'class-primary-5-cedar', sessionId: 'session-2026-27', termId: 'term-26-1', stage: 'draft', version: 1, assessmentVersion: initialAssessment.version, submittedBy: null, approvedBy: null, publishedAt: null, returnReason: null };
 const academic = { ...initialAssessment, subjects: initialAssessment.subjects.filter(s => s.id === 'subject-math'), finalizedKeys: [`${record.classId}:${record.sessionId}:${record.termId}:subject-math`] };
 const scope = [school, record.classId, record.sessionId, record.termId];
 const read = (authUserId = 'auth-teacher', reportId = 'report') => client.begin(async tx => readAuthoritativeReport(disposableAuthoritativeReadPort(wrap(tx), schema, async () => ({ authUserId })), reportId));
 const denied = async (expected, authUserId = 'auth-teacher', reportId = 'report') => assert.deepEqual(await read(authUserId, reportId), { ok: false, code: expected });
 try {
  await sql.unsafe('CREATE SCHEMA "' + schema + '"');
  await sql.unsafe('CREATE TABLE ' + table('identities') + ' (auth_user_id text PRIMARY KEY)');
  await sql.unsafe('CREATE TABLE ' + table('memberships') + ' (id text PRIMARY KEY,auth_user_id text NOT NULL,school_id text NOT NULL,role text NOT NULL,status text NOT NULL)');
  await sql.unsafe('CREATE TABLE ' + table('reports') + ' (school_id text NOT NULL,id text NOT NULL,enrollment_id text NOT NULL,record jsonb NOT NULL,PRIMARY KEY(school_id,id))');
  await sql.unsafe('CREATE TABLE ' + table('assignments') + ' (id text PRIMARY KEY,school_id text NOT NULL,membership_id text NOT NULL,class_id text NOT NULL,session_id text NOT NULL,status text NOT NULL)');
  await sql.unsafe('CREATE TABLE ' + table('scopes') + ' (school_id text NOT NULL,class_id text NOT NULL,session_id text NOT NULL,term_id text NOT NULL,revision integer NOT NULL,academic jsonb NOT NULL,PRIMARY KEY(school_id,class_id,session_id,term_id))');
  await sql.unsafe('CREATE TABLE ' + table('enrollments') + ' (id text PRIMARY KEY,school_id text NOT NULL,student_id text NOT NULL,class_id text NOT NULL,session_id text NOT NULL,status text NOT NULL)');
  await sql.unsafe('CREATE TABLE ' + table('subjects') + ' (school_id text NOT NULL,class_id text NOT NULL,session_id text NOT NULL,term_id text NOT NULL,subject_id text NOT NULL,finalized boolean NOT NULL,assessment_revision integer NOT NULL,config_revision integer NOT NULL,source_revision integer NOT NULL,PRIMARY KEY(school_id,class_id,session_id,term_id,subject_id))');
  for (const user of ['auth-teacher', 'auth-other']) await sql.unsafe('INSERT INTO ' + table('identities') + ' VALUES ($1)', [user]);
  await sql.unsafe('INSERT INTO ' + table('memberships') + ' VALUES ($1,$2,$3,$4,$5)', ['teacher', 'auth-teacher', school, 'teacher', 'active']);
  await sql.unsafe('INSERT INTO ' + table('memberships') + ' VALUES ($1,$2,$3,$4,$5)', ['other', 'auth-other', 'other-school', 'admin', 'active']);
  await sql.unsafe('INSERT INTO ' + table('reports') + ' VALUES ($1,$2,$3,$4::text::jsonb)', [school, 'report', 'enrollment', JSON.stringify(record)]);
  await sql.unsafe('INSERT INTO ' + table('assignments') + ' VALUES ($1,$2,$3,$4,$5,$6)', ['assignment', school, 'teacher', record.classId, record.sessionId, 'active']);
  await sql.unsafe('INSERT INTO ' + table('scopes') + ' VALUES ($1,$2,$3,$4,$5,$6::text::jsonb)', [...scope, record.assessmentVersion, JSON.stringify(academic)]);
  const enrollment = ['enrollment', school, record.studentId, record.classId, record.sessionId, 'active'];
  await sql.unsafe('INSERT INTO ' + table('enrollments') + ' VALUES ($1,$2,$3,$4,$5,$6)', enrollment);
  await sql.unsafe('INSERT INTO ' + table('subjects') + ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [...scope, 'subject-math', true, record.assessmentVersion, 1, 1]);

  const result = await read();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.locked.projection.subjects[0].result.total, 86);
  assert.equal(result.binding.enrollmentId, 'enrollment');
  assert.deepEqual(result.binding.sourceVersionKeys, ['["subject-math",1,1]']);
  console.log('PASS: SQL source reads recompute grades and derive persisted version binding');
  await denied('not_found', 'auth-other');
  await denied('forbidden', 'unknown-auth');
  await sql.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id='teacher'");
  try { await denied('forbidden'); } finally { await sql.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id='teacher'"); }
  await sql.unsafe('UPDATE ' + table('assignments') + " SET status='inactive'");
  try { await denied('forbidden'); } finally { await sql.unsafe('UPDATE ' + table('assignments') + " SET status='active'"); }
  console.log('PASS: foreign identity, missing membership, suspended teacher and inactive assignment fail closed');

  await sql.unsafe('INSERT INTO ' + table('enrollments') + ' VALUES ($1,$2,$3,$4,$5,$6)', ['duplicate', school, record.studentId, 'other-class', record.sessionId, 'active']);
  try { await denied('invalid_source'); } finally { await sql.unsafe('DELETE FROM ' + table('enrollments') + " WHERE id='duplicate'"); }
  await sql.unsafe('UPDATE ' + table('subjects') + ' SET finalized=false');
  try { await denied('invalid_source'); } finally { await sql.unsafe('UPDATE ' + table('subjects') + ' SET finalized=true'); }
  await sql.unsafe('UPDATE ' + table('subjects') + ' SET source_revision=0');
  try { await denied('read_failed'); } finally { await sql.unsafe('UPDATE ' + table('subjects') + ' SET source_revision=1'); }
  await sql.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision+1');
  try { await denied('stale_assessment'); } finally { await sql.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision-1'); }
  await sql.unsafe('DELETE FROM ' + table('subjects'));
  try { await denied('invalid_source'); } finally { await sql.unsafe('INSERT INTO ' + table('subjects') + ' VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [...scope, 'subject-math', true, record.assessmentVersion, 1, 1]); }
  console.log('PASS: duplicate enrollment, missing/unfinalized source, invalid persisted version and stale revision rejected');

  // A genuine conflicting UPDATE times out while the read transaction holds
  // locks. No timing sleeps or promise scheduling guesses establish blocking.
  await client.begin(async tx => {
   assert.equal((await readAuthoritativeReport(disposableAuthoritativeReadPort(wrap(tx), schema, async () => ({ authUserId: 'auth-teacher' })), 'report')).ok, true);
   const blocked = async query => {
    await assert.rejects(client.begin(async other => {
     await other.unsafe("SET LOCAL lock_timeout='200ms'");
     await other.unsafe("SET LOCAL statement_timeout='2s'");
     await other.unsafe(query);
    }), error => error.code === '55P03');
   };
   await blocked('UPDATE ' + table('scopes') + ' SET revision=revision+1');
   await blocked('UPDATE ' + table('identities') + " SET auth_user_id=auth_user_id WHERE auth_user_id='auth-teacher'");
   await blocked('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id='teacher'");
   await blocked('UPDATE ' + table('assignments') + " SET status='inactive'");
   await blocked('UPDATE ' + table('reports') + ' SET record=record');
   await blocked('UPDATE ' + table('enrollments') + " SET status='withdrawn'");
   await blocked('UPDATE ' + table('subjects') + ' SET source_revision=source_revision+1');
   console.log('PASS: read transaction holds report, identity, membership, assignment, enrollment and source locks');
  });
  await sql.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision+1');
  await denied('stale_assessment');
  await sql.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision-1');
  assert.equal((await read()).ok, true);
  console.log('PASS: locks release at transaction end and later reads detect source changes');

  // Combined read/write tests use the same synthetic report table. Existing
  // reader-only fixtures above deliberately do not require a version column.
  await sql.unsafe('ALTER TABLE ' + table('reports') + ' ADD COLUMN version integer NOT NULL DEFAULT 1');
  const workflowTable = name => '"' + schema + '"."' + name + '"';
  await sql.unsafe('CREATE TABLE ' + workflowTable('receipts') + ' (school_id text,actor_id text,operation_key text,report_id text,fingerprint text,resulting_version integer,PRIMARY KEY(school_id,actor_id,operation_key))');
  await sql.unsafe('CREATE TABLE ' + workflowTable('audits') + ' (school_id text,report_id text,version integer,payload jsonb)');
  await sql.unsafe('CREATE TABLE ' + workflowTable('releases') + ' (school_id text,report_id text,version integer,published_at text,UNIQUE(school_id,report_id,version))');
  const command = (action = 'submit', expectedVersion = 1, idempotencyKey = 'submit') => ({ reportId: 'report', command: { action, expectedVersion, assessmentVersion: record.assessmentVersion, idempotencyKey } });
  const clock = () => '2026-10-19T09:00:00Z';
  const database = (afterUpdate = async () => {}) => ({ unsafe: sql.unsafe, begin: callback => client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe("SET LOCAL lock_timeout='300ms'");
   await bound.unsafe("SET LOCAL statement_timeout='3s'");
   return callback({ unsafe: async (query, parameters) => {
    const result = await bound.unsafe(query, parameters);
    if (query.startsWith('UPDATE ' + table('reports'))) await afterUpdate();
    return result;
   } });
  }) });
  const execute = (input = command(), db = database(), user = 'auth-teacher') => executeTrustedDisposableReport(db, schema, input, async () => ({ authUserId: user }), clock);
  const resetWorkflow = async () => {
   await sql.unsafe('TRUNCATE ' + ['audits', 'receipts', 'releases'].map(workflowTable).join(','));
   await sql.unsafe('UPDATE ' + table('reports') + ' SET version=1,record=$1::text::jsonb', [JSON.stringify(record)]);
  };
  const workflowState = async () => ({
   reports: Array.from(await sql.unsafe('SELECT version,record FROM ' + table('reports')), row => ({ ...row })),
   audits: Array.from(await sql.unsafe('SELECT * FROM ' + workflowTable('audits') + ' ORDER BY version'), row => ({ ...row })),
   receipts: Array.from(await sql.unsafe('SELECT * FROM ' + workflowTable('receipts') + ' ORDER BY operation_key'), row => ({ ...row })),
   releases: Array.from(await sql.unsafe('SELECT * FROM ' + workflowTable('releases') + ' ORDER BY version'), row => ({ ...row }))
  });
  await resetWorkflow();
  const competing = await Promise.all([execute(command('submit', 1, 'a')), execute(command('submit', 1, 'b'))]);
  assert.equal(competing.filter(r => r.ok && r.kind === 'applied').length, 1, JSON.stringify(competing));
  assert.equal(competing.filter(r => !r.ok && r.code === 'stale_version').length, 1, JSON.stringify(competing));
  await resetWorkflow();
  assert.deepEqual(await execute(), { ok: true, kind: 'applied', version: 2 });
  assert.deepEqual(await execute(), { ok: true, kind: 'replay', version: 2 });
  const committed = await workflowState();
  assert.equal((await execute(command('submit', 2))).code, 'conflict');
  assert.deepEqual(await workflowState(), committed);
  console.log('PASS: combined trusted transaction serializes submissions, replays and rejects changed payload');
  await resetWorkflow();
  const duplicates = await Promise.all([execute(), execute()]);
  assert.equal(duplicates.filter(r => r.ok && r.kind === 'applied').length, 1, JSON.stringify(duplicates));
  assert.equal(duplicates.filter(r => r.ok && r.kind === 'replay').length, 1, JSON.stringify(duplicates));
  assert.equal((await workflowState()).receipts.length, 1);


  for (const failedTable of ['audits', 'receipts']) {
   await resetWorkflow(); const before = await workflowState();
   const column = failedTable === 'audits' ? 'version' : 'resulting_version';
   await sql.unsafe('ALTER TABLE ' + workflowTable(failedTable) + ' ADD CONSTRAINT reject_combined CHECK (' + column + ' <> 2)');
   try {
    assert.equal((await execute()).code, 'transaction_failed');
    assert.deepEqual(await workflowState(), before, failedTable + ' failure committed partial writes');
   } finally { await sql.unsafe('ALTER TABLE ' + workflowTable(failedTable) + ' DROP CONSTRAINT reject_combined'); }
   assert.deepEqual(await execute(), { ok: true, kind: 'applied', version: 2 });
  }
  console.log('PASS: combined outer transaction rolls back audit/receipt errors and allows same-key retry');
  await sql.unsafe('INSERT INTO ' + table('identities') + ' VALUES ($1)', ['auth-admin']);
  await sql.unsafe('INSERT INTO ' + table('memberships') + ' VALUES ($1,$2,$3,$4,$5)', ['admin', 'auth-admin', school, 'admin', 'active']);
  assert.deepEqual(await execute(command('approve', 2, 'approve'), database(), 'auth-admin'), { ok: true, kind: 'applied', version: 3 });
  const beforeRelease = await workflowState();
  await sql.unsafe('ALTER TABLE ' + workflowTable('releases') + ' ADD CONSTRAINT reject_release CHECK (version <> 4)');
  try {
   assert.equal((await execute(command('publish', 3, 'publish'), database(), 'auth-admin')).code, 'transaction_failed');
   assert.deepEqual(await workflowState(), beforeRelease);
  } finally { await sql.unsafe('ALTER TABLE ' + workflowTable('releases') + ' DROP CONSTRAINT reject_release'); }
  assert.deepEqual(await execute(command('publish', 3, 'publish'), database(), 'auth-admin'), { ok: true, kind: 'applied', version: 4 });
  assert.deepEqual(await execute(command('publish', 3, 'publish'), database(), 'auth-admin'), { ok: true, kind: 'replay', version: 4 });
  assert.equal((await workflowState()).releases.length, 1);
  console.log('PASS: combined publish failure rolls back report/audit/receipt, retry releases once');


  await resetWorkflow();
  let checked = false;
  const protectedDb = database(async () => {
   checked = true;
   await assert.rejects(client.begin(async tx => {
    await tx.unsafe("SET LOCAL lock_timeout='150ms'");
    await tx.unsafe("SET LOCAL statement_timeout='2s'");
    await tx.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision+1');
   }), error => error.code === '55P03');
  });
  assert.deepEqual(await execute(command(), protectedDb), { ok: true, kind: 'applied', version: 2 });
  assert.equal(checked, true);
  console.log('PASS: source mutation cannot interleave between combined report update and audit commit');

  await resetWorkflow();
  const beforeSourceChange = await workflowState();
  await client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe('SELECT revision FROM ' + table('scopes') + ' FOR UPDATE');
   const blockedSubmission = await execute();
   assert.equal(blockedSubmission.ok, false);
   assert.equal(blockedSubmission.code, 'read_failed');
   await bound.unsafe('UPDATE ' + table('scopes') + ' SET revision=revision+1,academic=$1::text::jsonb', [JSON.stringify({ ...academic, version: record.assessmentVersion + 1 })]);
   await bound.unsafe('UPDATE ' + table('subjects') + ' SET assessment_revision=assessment_revision+1,source_revision=source_revision+1');
  });
  assert.equal((await execute()).code, 'stale_assessment');
  assert.deepEqual(await workflowState(), beforeSourceChange);
  console.log('PASS: source-first writer blocks submission; committed revision rejects stale report without writes');

 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE'); } finally { await client.end(); }
 }
}
