// Opt-in synthetic PostgreSQL read-port tests. No application env or schema.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
import { initialAssessment, previewSchoolId } from '../src/components/academics/calendar-assessment-fixtures.ts';
import { readAuthoritativeReport } from '../src/lib/academics/report-card-authoritative-read.ts';
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
 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE'); } finally { await client.end(); }
 }
}
