// Opt-in, schema-faithful fixture tests only. Never imports Drizzle Kit/config/env.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeFixtureAuthorityDDL } from './lib/report-card-complete-fixture-ddl.mjs';
import { executeCompleteFixtureReport } from '../src/lib/academics/report-card-complete-fixture-boundary.ts';
import { readFixtureRelationalAssessment } from '../src/lib/academics/assessment-postgres-fixture-source-reader.ts';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from '../src/lib/academics/assessment-postgres-canonical-reader.ts';
import { executeFixtureReportRevocation } from '../src/lib/academics/report-card-postgres-revoke-writer.ts';
import { executeFixtureReportWorkflow } from '../src/lib/academics/report-card-postgres-workflow-writer.ts';
import { executeFixtureCanonicalReportCommand } from '../src/lib/academics/report-card-postgres-canonical-writer.ts';
import { buildApprovedReportSnapshot } from '../src/lib/academics/report-card-approved-snapshot.ts';
import { canonicalizeSnapshotValue } from '../src/lib/academics/report-card-canonical-snapshot.ts';
import postgres from 'postgres';
import { disposableLoginPlan, inspectDisposableLogin, disposableLoginURL } from './lib/disposable-login-plan.mjs';
import { awaitFixtureAuthorityLock } from './lib/actor-authority-fixture-lifecycle.mjs';
import { disposableSessionRendezvous } from './lib/disposable-session-rendezvous.mjs';
import { reportReleaseGuardDDL } from './lib/report-release-disposable-guards.mjs';
import { fixtureSecurityPlan } from './lib/assessment-disposable-security-plan.mjs';
import { fixtureRolePreflightPlan, inspectFixtureRestrictedRoles } from './lib/assessment-disposable-role-preflight.mjs';
import { assessmentAuthorityGuardDDL } from './lib/assessment-disposable-authority-guards.mjs';
import { assessmentWriteGuardDDL } from './lib/assessment-disposable-write-guards.mjs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { assessmentFixtureDDL, fixtureTables, reportFixtureTables, fixtureIdentifier as q } from './lib/assessment-disposable-schema.mjs';

const url = process.env.REPORT_CARD_TEST_DATABASE_URL;
if (!url || process.env.REPORT_CARD_TEST_CONFIRM !== 'DISPOSABLE_REPORT_CARD_TEST_ONLY') {
 console.error('SKIPPED: explicit disposable database URL and confirmation required.'); process.exitCode = 2;
} else {
 const parsed = new URL(url);
 if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw Error('Only a local disposable test database is permitted.');
 const schema = 'rc_it_' + randomBytes(8).toString('hex');
 const fixture = assessmentFixtureDDL(schema, { includeReports: true });
 const client = postgres(url, { max: 4, prepare: false, connect_timeout: 5, onnotice: () => {} });
 const wrap = tx => ({ unsafe: (query, parameters = []) => tx.unsafe(query, parameters.map(v => typeof v === 'string' ? client.typed(v, 25) : v)) });
 const sql = wrap(client); const table = fixture.table;
 const configs = new Map([...fixtureTables, ...reportFixtureTables].map(t => { const c = getTableConfig(t); return [c.name, c]; }));
 const insert = (tx, name, row) => {
  const c = configs.get(name); assert.ok(c, 'unknown fixture table');
  const keys = Object.keys(row);
  const values = keys.map(key => {
   const value = row[key]; return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
  });
  const placeholders = keys.map((key, i) => {
   const column = c.columns.find(col => col.name === key); assert.ok(column, key);
   const type = fixture.columnType(column);
   return '$' + (i + 1) + (type === 'jsonb' ? '::text::jsonb' : '::' + type);
  });
  return tx.unsafe('INSERT INTO ' + table(name) + ' (' + keys.map(q).join(',') + ') VALUES (' + placeholders.join(',') + ')', values);
 };
 const expectError = async (code, callback) => assert.rejects(callback, error => error.code === code);
 const ids = Object.fromEntries(['school', 'foreignSchool', 'teacherUser', 'adminUser', 'teacher', 'admin', 'session', 'otherSession', 'term', 'otherTerm', 'level', 'section', 'class', 'student', 'otherStudent', 'enrollment', 'assignment', 'subject', 'foreignSubject', 'config', 'defaultConfig', 'scope', 'otherScope', 'roster', 'otherRoster', 'score', 'source', 'otherSource', 'review', 'finalization'].map(key => [key, randomUUID()]));
 const hash = 'a'.repeat(64);
 const configRow = { id: ids.config, school_id: ids.school, config_key: randomUUID(), revision: 1, level_id: ids.level, session_id: ids.session, term_id: ids.term, subject_id: ids.subject, mode: 'numeric', state: 'finalized', components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }], grading: { mode: 'numeric', bands: [{ min: 0, max: 100, label: 'A' }] } };
 const scopeRow = { id: ids.scope, school_id: ids.school, class_id: ids.class, session_id: ids.session, term_id: ids.term };
 const rosterRow = { id: ids.roster, school_id: ids.school, scope_id: ids.scope, subject_id: ids.subject, config_version_id: ids.config };
 const scoreRow = { id: ids.score, school_id: ids.school, roster_id: ids.roster, config_version_id: ids.config, enrollment_id: ids.enrollment, student_id: ids.student, component_key: 'exam', numeric_score: '86.0000', observation_key: null, updated_by: ids.teacher };
 const sourceRow = { id: ids.source, school_id: ids.school, scope_id: ids.scope, revision: 1, source_manifest: { format: 1, fixture: true }, content_hash: hash };
 const reviewRow = { id: ids.review, school_id: ids.school, scope_id: ids.scope, roster_id: ids.roster, source_version_id: ids.source, reviewer_membership_id: ids.teacher };
 const finalRow = { id: ids.finalization, school_id: ids.school, scope_id: ids.scope, roster_id: ids.roster, source_version_id: ids.source, teacher_review_id: ids.review, finalized_by: ids.admin, results: { fixture: true, students: [] }, content_hash: hash };
 const roleConfirmation=process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM;
 const testRestrictedRoles=roleConfirmation==='DISPOSABLE_ROLE_ADMIN_TEST_ONLY';
 try {
  if(roleConfirmation && !testRestrictedRoles) throw Error('Invalid disposable role-admin confirmation.');
  if(testRestrictedRoles) {
   const capability=await sql.unsafe('SELECT rolsuper OR rolcreaterole AS allowed FROM pg_catalog.pg_roles WHERE rolname=current_user');
   if(capability[0]?.allowed!==true) throw Error('Restricted-role groups require a local disposable test connection with CREATEROLE. No roles or fixture schema were created. Do not grant production privileges; use a separately authorized local test administrator.');
  }
  for (const statement of fixture.statements) await sql.unsafe(statement);
  const actual = await sql.unsafe('SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=$1', [schema]);
  assert.equal(actual[0].n, fixture.tableCount);
  console.log('PASS: all 27 fixture relations created from actual metadata with isolated prerequisites');
  for (const [id, slug] of [[ids.school, 'fictional-school'], [ids.foreignSchool, 'fictional-other']]) await insert(sql, 'schools', { id, name: slug, slug, final_primary_year: 5 });
  for (const [id, name] of [[ids.teacherUser, 'Fictional Teacher'], [ids.adminUser, 'Fictional Admin']]) await insert(sql, 'school_users', { id, auth_user_id: randomUUID(), display_name: name });
  for (const [id, user, role] of [[ids.teacher, ids.teacherUser, 'teacher'], [ids.admin, ids.adminUser, 'admin']]) await insert(sql, 'memberships', { id, school_id: ids.school, user_id: user, role });
  for (const [id, label] of [[ids.session, '2026-2027'], [ids.otherSession, '2027-2028']]) await insert(sql, 'academic_sessions', { id, school_id: ids.school, label, starts_on: '2026-09-01', ends_on: '2027-07-31' });
  for (const [id, session] of [[ids.term, ids.session], [ids.otherTerm, ids.otherSession]]) await insert(sql, 'terms', { id, school_id: ids.school, session_id: session, name: 'First Term', starts_on: '2026-09-01', ends_on: '2026-12-18' });
  await insert(sql, 'academic_levels', { id: ids.level, school_id: ids.school, name: 'Primary 5', stage: 'primary', primary_year: 5, progression_order: 1 });
  await insert(sql, 'academic_sections', { id: ids.section, school_id: ids.school, level_id: ids.level, name: 'Cedar', display_order: 1 });
  await insert(sql, 'classes', { id: ids.class, school_id: ids.school, name: 'Primary 5 Cedar', section: 'Cedar', level_id: ids.level, section_id: ids.section });
  for (const [id, admission] of [[ids.student, 'FICTION-001'], [ids.otherStudent, 'FICTION-002']]) await insert(sql, 'students', { id, school_id: ids.school, admission_number: admission, first_name: 'Fictional', last_name: admission });
  await insert(sql, 'enrollments', { id: ids.enrollment, school_id: ids.school, student_id: ids.student, class_id: ids.class, session_id: ids.session });
  await insert(sql, 'teacher_class_assignments', { id: ids.assignment, school_id: ids.school, teacher_membership_id: ids.teacher, class_id: ids.class, session_id: ids.session });
  for (const [id, school] of [[ids.subject, ids.school], [ids.foreignSubject, ids.foreignSchool]]) await insert(sql, 'assessment_subjects', { id, school_id: school, code: 'MATH', name: 'Mathematics' });
  await insert(sql, 'assessment_config_versions', configRow);
  await insert(sql, 'assessment_config_versions', { ...configRow, id: ids.defaultConfig, config_key: randomUUID(), subject_id: null });
  await insert(sql, 'assessment_scopes', scopeRow);
  await insert(sql, 'assessment_scopes', { ...scopeRow, id: ids.otherScope, session_id: ids.otherSession, term_id: ids.otherTerm });
  await insert(sql, 'assessment_subject_roster', rosterRow);
  await insert(sql, 'assessment_subject_roster', { ...rosterRow, id: ids.otherRoster, scope_id: ids.otherScope });
  await insert(sql, 'assessment_teacher_subjects', { school_id: ids.school, roster_id: ids.roster, class_assignment_id: ids.assignment });
  await insert(sql, 'assessment_scores', scoreRow);
  await insert(sql, 'assessment_source_versions', sourceRow);
  await insert(sql, 'assessment_source_versions', { ...sourceRow, id: ids.otherSource, scope_id: ids.otherScope });
  await insert(sql, 'assessment_teacher_reviews', reviewRow);
  await insert(sql, 'assessment_finalizations', finalRow);

  await expectError('23503', () => insert(sql, 'assessment_subject_roster', { ...rosterRow, id: randomUUID(), subject_id: ids.foreignSubject }));
  await expectError('23503', () => insert(sql, 'assessment_scopes', { ...scopeRow, id: randomUUID(), term_id: ids.otherTerm }));
  await expectError('23505', () => insert(sql, 'assessment_config_versions', { ...configRow, id: randomUUID(), config_key: randomUUID(), subject_id: null }));
  console.log('PASS: cross-school subject, wrong-session term and duplicate default config rejected');
  await expectError('23505', () => insert(sql, 'assessment_scores', { ...scoreRow, id: randomUUID() }));
  await expectError('23503', () => insert(sql, 'assessment_scores', { ...scoreRow, id: randomUUID(), student_id: ids.otherStudent, component_key: 'other' }));
  await expectError('23503', () => insert(sql, 'assessment_scores', { ...scoreRow, id: randomUUID(), config_version_id: ids.defaultConfig, component_key: 'other' }));
  await expectError('23514', () => insert(sql, 'assessment_scores', { ...scoreRow, id: randomUUID(), component_key: 'invalid', observation_key: 'emerging' }));
  await expectError('23514', () => insert(sql, 'assessment_scores', { ...scoreRow, id: randomUUID(), component_key: 'invalid', numeric_score: '-1' }));
  console.log('PASS: score uniqueness, enrollment/student identity, pinned config and value checks enforced');
  await expectError('23503', () => insert(sql, 'assessment_teacher_reviews', { ...reviewRow, id: randomUUID(), source_version_id: ids.otherSource }));
  await expectError('23503', () => insert(sql, 'assessment_finalizations', { ...finalRow, id: randomUUID(), source_version_id: ids.otherSource }));
  await expectError('23505', () => insert(sql, 'assessment_finalizations', { ...finalRow, id: randomUUID() }));
  console.log('PASS: reviews and finalizations bind exact source, roster and scope');
  await expectError('23505', () => insert(sql, 'assessment_subject_roster', { ...rosterRow, id: randomUUID(), roster_version: 2 }));
  await sql.unsafe('UPDATE ' + table('assessment_subject_roster') + ' SET is_active=false WHERE id=$1::uuid', [ids.roster]);
  const nextRoster = randomUUID();
  const editableScore = randomUUID();
  await insert(sql, 'assessment_subject_roster', { ...rosterRow, id: nextRoster, roster_version: 2 });
  await insert(sql, 'assessment_scores', { ...scoreRow, id: editableScore, roster_id: nextRoster });
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('assessment_subject_roster') + ' WHERE scope_id=$1::uuid', [ids.scope]))[0].n, 2);
  console.log('PASS: subject roster retains history with only one active version');

  // Candidate append-only enforcement exists ONLY inside this generated schema.
  await sql.unsafe('CREATE FUNCTION ' + table('reject_append_only') + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable assessment fixture' USING ERRCODE='P0001'; RETURN NULL; END $$");
  const immutable = ['assessment_source_versions', 'assessment_teacher_reviews', 'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts'];
  for (const name of immutable) {
   await sql.unsafe('CREATE TRIGGER fixture_append_only BEFORE UPDATE OR DELETE ON ' + table(name) + ' FOR EACH ROW EXECUTE FUNCTION ' + table('reject_append_only') + '()');
   await sql.unsafe('CREATE TRIGGER fixture_no_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('reject_append_only') + '()');
  }
  await sql.unsafe('CREATE TRIGGER fixture_final_config BEFORE UPDATE OR DELETE ON ' + table('assessment_config_versions') + " FOR EACH ROW WHEN (OLD.state='finalized') EXECUTE FUNCTION " + table('reject_append_only') + '()');
  await sql.unsafe('CREATE TRIGGER fixture_config_no_truncate BEFORE TRUNCATE ON ' + table('assessment_config_versions') + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('reject_append_only') + '()');
  const auditRow = { school_id: ids.school, scope_id: ids.scope, actor_membership_id: ids.admin, action: 'review', before_revision: 1, after_revision: 1 };
  const receiptRow = { school_id: ids.school, scope_id: ids.scope, actor_membership_id: ids.admin, operation_key: 'fixture-review', fingerprint: hash, resulting_revision: 1, outcome: { ok: true } };
  await insert(sql, 'assessment_audit', auditRow); await insert(sql, 'assessment_operation_receipts', receiptRow);
  for (const name of immutable) {
   await expectError('P0001', () => sql.unsafe('UPDATE ' + table(name) + ' SET school_id=school_id'));
   await expectError('P0001', () => sql.unsafe('DELETE FROM ' + table(name)));
   await expectError('P0001', () => sql.unsafe('TRUNCATE ' + table(name) + ' CASCADE'));
  }
  await expectError('P0001', () => sql.unsafe('UPDATE ' + table('assessment_config_versions') + ' SET revision=revision+1 WHERE id=$1::uuid', [ids.config]));
  console.log('PASS: fixture append-only triggers reject update/delete/truncate and finalized config mutation');

  // Explicit guarded mutation: no claim that direct child SQL is restricted.
  const change = key => client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe("SET LOCAL lock_timeout='2s'"); await bound.unsafe("SET LOCAL statement_timeout='5s'");
   const locked = await bound.unsafe('SELECT revision FROM ' + table('assessment_scopes') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR UPDATE', [ids.school, ids.scope]);
   if (locked[0].revision !== 1) return 'stale';
   await bound.unsafe('UPDATE ' + table('assessment_scores') + ' SET numeric_score=87,version=version+1,updated_by=$2::uuid WHERE id=$1::uuid', [editableScore, ids.admin]);
   const changed = await bound.unsafe('UPDATE ' + table('assessment_scopes') + ' SET revision=2 WHERE school_id=$1::uuid AND id=$2::uuid AND revision=1 RETURNING revision', [ids.school, ids.scope]);
   assert.equal(changed.length, 1);
   await insert(bound, 'assessment_audit', { ...auditRow, action: 'score_change', after_revision: 2 });
   await insert(bound, 'assessment_operation_receipts', { ...receiptRow, operation_key: key, resulting_revision: 2 });
   return 'applied';
  });
  const before = (await sql.unsafe('SELECT numeric_score::text AS score,version FROM ' + table('assessment_scores') + ' WHERE id=$1::uuid', [editableScore]))[0];
  await expectError('23505', () => change('fixture-review'));
  assert.equal((await sql.unsafe('SELECT revision FROM ' + table('assessment_scopes') + ' WHERE id=$1::uuid', [ids.scope]))[0].revision, 1);
  const after = (await sql.unsafe('SELECT numeric_score::text AS score,version FROM ' + table('assessment_scores') + ' WHERE id=$1::uuid', [editableScore]))[0];
  assert.deepEqual(after, before);
  const racing = await Promise.all([change('edit-a'), change('edit-b')]);
  assert.deepEqual(racing.sort(), ['applied', 'stale']);
  assert.equal((await sql.unsafe('SELECT revision FROM ' + table('assessment_scopes') + ' WHERE id=$1::uuid', [ids.scope]))[0].revision, 2);
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('assessment_audit') + " WHERE action='score_change'"))[0].n, 1);
  console.log('PASS: guarded source writes roll back receipt collisions and serialize revision changes');

  // Build additional terms/classes before installing candidate source guards.
  const secondTerm = randomUUID(), secondSection = randomUUID(), secondClass = randomUUID();
  const secondTermScope = randomUUID(), destinationScope = randomUUID(), newScope = randomUUID();
  await insert(sql, 'terms', { id: secondTerm, school_id: ids.school, session_id: ids.session, name: 'Second Term', starts_on: '2027-01-01', ends_on: '2027-04-01' });
  await insert(sql, 'academic_sections', { id: secondSection, school_id: ids.school, level_id: ids.level, name: 'Maple', display_order: 2 });
  await insert(sql, 'classes', { id: secondClass, school_id: ids.school, name: 'Primary 5 Maple', section: 'Maple', level_id: ids.level, section_id: secondSection });
  await insert(sql, 'assessment_scopes', { ...scopeRow, id: secondTermScope, term_id: secondTerm });
  await insert(sql, 'assessment_scopes', { ...scopeRow, id: destinationScope, class_id: secondClass });
  const guards = assessmentWriteGuardDDL(schema);
  for (const statement of guards.statements) await sql.unsafe(statement);
  const revisions = async () => Object.fromEntries((await sql.unsafe('SELECT id,revision FROM ' + table('assessment_scopes') + ' ORDER BY id')).map(row => [row.id, row.revision]));
  const assertIncrement = (before, after, affected) => {
   assert.deepEqual(Object.keys(after).sort(), Object.keys(before).sort());
   for (const id of Object.keys(before)) assert.equal(after[id], before[id] + (affected.includes(id) ? 1 : 0), id);
  };
  const phantomEnrollment = randomUUID();
  const enrollmentRow = { id: phantomEnrollment, school_id: ids.school, student_id: ids.otherStudent, class_id: ids.class, session_id: ids.session };
  const pendingScope = { ...scopeRow, id: newScope, class_id: secondClass, term_id: secondTerm };
  const boundedWrite = work => client.begin(async tx => {
   const bound = wrap(tx); await bound.unsafe("SET LOCAL lock_timeout='150ms'"); await bound.unsafe("SET LOCAL statement_timeout='2s'"); return work(bound);
  });
  await client.begin(async tx => {
   const bound = wrap(tx); assert.equal((await bound.unsafe(guards.readGate)).length, 1);
   const beforeCount = (await bound.unsafe('SELECT count(*)::int AS n FROM ' + table('enrollments')))[0].n;
   await expectError('55P03', () => boundedWrite(other => insert(other, 'enrollments', enrollmentRow)));
   await expectError('55P03', () => boundedWrite(other => insert(other, 'assessment_scopes', pendingScope)));
   assert.equal((await bound.unsafe('SELECT count(*)::int AS n FROM ' + table('enrollments')))[0].n, beforeCount);
   assert.equal((await bound.unsafe('SELECT count(*)::int AS n FROM ' + table('assessment_scopes') + ' WHERE id=$1::uuid', [newScope]))[0].n, 0);
  });
  let beforeGuards = await revisions();
  await insert(sql, 'enrollments', enrollmentRow);
  let afterGuards = await revisions();
  assertIncrement(beforeGuards, afterGuards, [ids.scope, secondTermScope]);
  await insert(sql, 'assessment_scopes', pendingScope);
  assert.equal((await revisions())[newScope], 2);
  console.log('PASS: shared discovery gate blocks phantom enrollment/scope inserts; later inserts invalidate all relevant terms');

  beforeGuards = await revisions();
  await client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe('UPDATE ' + table('enrollments') + ' SET class_id=$1::uuid WHERE id=$2::uuid', [secondClass, phantomEnrollment]);
   await bound.unsafe('UPDATE ' + table('assessment_scores') + ' SET numeric_score=88,version=version+1 WHERE id=$1::uuid', [editableScore]);
   await bound.unsafe('UPDATE ' + table('assessment_scores') + ' SET numeric_score=89,version=version+1 WHERE id=$1::uuid', [editableScore]);
  });
  afterGuards = await revisions();
  assertIncrement(beforeGuards, afterGuards, [ids.scope, secondTermScope, destinationScope, newScope]);
  console.log('PASS: enrollment transfer invalidates old/new class terms once even with repeated score writes');

  beforeGuards = await revisions();
  let rejectedTransaction;
  await expectError('23505', () => client.begin(async tx => {
   const bound = wrap(tx); rejectedTransaction = (await bound.unsafe('SELECT pg_current_xact_id()::text AS id'))[0].id;
   await bound.unsafe('UPDATE ' + table('enrollments') + ' SET class_id=$1::uuid WHERE id=$2::uuid', [ids.class, phantomEnrollment]);
   await insert(bound, 'assessment_operation_receipts', receiptRow);
  }));
  assert.deepEqual(await revisions(), beforeGuards);
  assert.equal((await sql.unsafe('SELECT class_id FROM ' + table('enrollments') + ' WHERE id=$1::uuid', [phantomEnrollment]))[0].class_id, secondClass);
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('fixture_source_write_claims') + ' WHERE transaction_id=$1', [rejectedTransaction]))[0].n, 0);
  console.log('PASS: failed receipt rolls back guarded enrollment, revision fan-out and transaction claims');

  beforeGuards = await revisions();
  await sql.unsafe('DELETE FROM ' + table('enrollments') + ' WHERE id=$1::uuid', [phantomEnrollment]);
  assertIncrement(beforeGuards, await revisions(), [destinationScope, newScope]);
  await expectError('P0001', () => sql.unsafe('TRUNCATE ' + table('enrollments') + ' CASCADE'));
  await expectError('P0001', () => sql.unsafe('DELETE FROM ' + table('assessment_scopes') + ' WHERE id=$1::uuid', [newScope]));
  console.log('PASS: deletes invalidate former enrollment scopes while truncate and scope deletion are blocked');

  beforeGuards = await revisions();
  const currentSource = randomUUID(), currentReview = randomUUID();
  await insert(sql, 'assessment_source_versions', { ...sourceRow, id: currentSource, revision: beforeGuards[ids.scope] });
  await insert(sql, 'assessment_teacher_reviews', { ...reviewRow, id: currentReview, roster_id: nextRoster, source_version_id: currentSource });
  await insert(sql, 'assessment_finalizations', { ...finalRow, id: randomUUID(), roster_id: nextRoster, source_version_id: currentSource, teacher_review_id: currentReview });
  assert.deepEqual(await revisions(), beforeGuards);
  console.log('PASS: source materialization, review and finalization preserve the academic source revision');

  // Read actual base/proposal relations under the discovery barrier.
  const nextTeacherLink = randomUUID();
  await insert(sql, 'assessment_teacher_subjects', { id: nextTeacherLink, school_id: ids.school, roster_id: nextRoster, class_assignment_id: ids.assignment });
  const authUser = (await sql.unsafe('SELECT auth_user_id FROM ' + table('school_users') + ' WHERE id=$1::uuid', [ids.teacherUser]))[0].auth_user_id;
  const selector = { studentId: ids.student, enrollmentId: ids.enrollment, classId: ids.class, sessionId: ids.session, termId: ids.term };
  const readRelational = (selected = selector) => client.begin(tx => readFixtureRelationalAssessment(wrap(tx), schema, selected, async () => ({ authUserId: authUser })));
  const relational = await readRelational();
  assert.equal(relational.ok, true, JSON.stringify(relational));
  assert.equal(relational.source.identity.membership.id, ids.teacher);
  assert.equal(relational.source.subjects[0].scores[0].numericScore, '89.0000');
  assert.equal(relational.source.subjects[0].teacherReviewId, currentReview);
  assert.equal(relational.source.revision, (await revisions())[ids.scope]);
  console.log('PASS: relational reader joins verified identity, enrollment, pinned config, scores and current finalized source');

  assert.deepEqual(await readRelational({ ...selector, enrollmentId: randomUUID() }), { ok: false, code: 'invalid_reference' });
  assert.deepEqual(await readRelational({ ...selector, termId: ids.otherTerm }), { ok: false, code: 'invalid_reference' });
  await sql.unsafe('UPDATE ' + table('assessment_teacher_subjects') + ' SET is_active=false WHERE id=$1::uuid', [nextTeacherLink]);
  try { assert.deepEqual(await readRelational(), { ok: false, code: 'forbidden' }); }
  finally { await sql.unsafe('UPDATE ' + table('assessment_teacher_subjects') + ' SET is_active=true WHERE id=$1::uuid', [nextTeacherLink]); }
  await sql.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [ids.admin]);
  try { assert.deepEqual(await readRelational(), { ok: false, code: 'incomplete_source' }); }
  finally { await sql.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id=$1::uuid", [ids.admin]); }
  console.log('PASS: relational reader rejects forged enrollment, wrong term, missing subject permission and suspended finalizer');

  await client.begin(async tx => {
   assert.equal((await readFixtureRelationalAssessment(wrap(tx), schema, selector, async () => ({ authUserId: authUser }))).ok, true);
   await expectError('55P03', () => boundedWrite(other => insert(other, 'enrollments', { ...enrollmentRow, id: randomUUID() })));
   await expectError('55P03', () => boundedWrite(other => other.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [ids.admin])));
  });
  await sql.unsafe('UPDATE ' + table('assessment_scores') + ' SET numeric_score=numeric_score WHERE id=$1::uuid', [editableScore]);
  assert.deepEqual(await readRelational(), { ok: false, code: 'incomplete_source' });
  console.log('PASS: relational read holds discovery/authority locks and later score edits invalidate old finalization');

  // Complete scope: a second active pupil must contribute scores and results.
  const canonicalEnrollment = randomUUID(), canonicalScore = randomUUID();
  await insert(sql, 'enrollments', { ...enrollmentRow, id: canonicalEnrollment });
  await insert(sql, 'assessment_scores', { ...scoreRow, id: canonicalScore, roster_id: nextRoster, enrollment_id: canonicalEnrollment, student_id: ids.otherStudent, numeric_score: '69.9950' });
  const scopeSelector = { classId: ids.class, sessionId: ids.session, termId: ids.term };
  const verifyIdentity = async () => ({ authUserId: authUser });
  const readCanonical = () => client.begin(tx => readFixtureVerifiedCanonicalAssessment(wrap(tx), schema, scopeSelector, verifyIdentity));
  // Fixture sealing always takes the EXCLUSIVE discovery gate before touching
  // scores or invoking candidate reads; never upgrade a shared read transaction.
  let expectedPupilCount = 2;
  const seal = (bad = null) => client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe(guards.readGate.replace('FOR SHARE', 'FOR UPDATE'));
   await bound.unsafe('UPDATE ' + table('assessment_scores') + ' SET version=version+1 WHERE id=$1::uuid', [editableScore]);
   const loaded = await loadFixtureCompleteAssessment(bound, schema, scopeSelector, verifyIdentity);
   assert.equal(loaded.ok, true, JSON.stringify(loaded));
   assert.equal(loaded.input.students.length, expectedPupilCount);
   const sourceId = randomUUID();
   await insert(bound, 'assessment_source_versions', { id: sourceId, school_id: ids.school, scope_id: ids.scope, revision: loaded.input.scope.revision,
    source_manifest: bad === 'manifest' ? { fixture: true } : JSON.parse(loaded.materialized.manifest.canonicalJson), content_hash: loaded.materialized.manifest.sha256 });
   for (const subject of loaded.materialized.subjects) {
    const reviewId = randomUUID();
    await insert(bound, 'assessment_teacher_reviews', { ...reviewRow, id: reviewId, roster_id: subject.rosterId, source_version_id: sourceId });
    const results = JSON.parse(subject.results.canonicalJson);
    if (bad === 'results') results.students[0].result.total = '100.00';
    await insert(bound, 'assessment_finalizations', { ...finalRow, id: randomUUID(), roster_id: subject.rosterId, source_version_id: sourceId, teacher_review_id: reviewId, results,
     content_hash: bad === 'results' ? createHash('sha256').update(canonicalizeSnapshotValue(results)).digest('hex') : subject.results.sha256 });
   }
   return sourceId;
  });
  const sealedSource = await seal();
  const verifiedCanonical = await readCanonical();
  assert.equal(verifiedCanonical.ok, true, JSON.stringify(verifiedCanonical));
  assert.equal(verifiedCanonical.sourceVersionId, sealedSource);
  assert.equal(verifiedCanonical.input.enrollments.length, 2);
  const completeResults = JSON.parse(verifiedCanonical.materialized.subjects[0].results.canonicalJson);
  assert.equal(completeResults.students.find(s => s.studentId === ids.otherStudent).result.total, '70.00');
  console.log('PASS: complete locked SQL scope round trips canonical JSONB and recalculates every pupil');

  await seal('manifest');
  assert.deepEqual(await readCanonical(), { ok: false, code: 'source_mismatch' });
  await seal('results');
  assert.deepEqual(await readCanonical(), { ok: false, code: 'finalization_mismatch' });
  await seal();
  assert.equal((await readCanonical()).ok, true);
  console.log('PASS: canonical reader rejects minimal manifests and forged results with recomputed hashes');

  const beforeConflict = await revisions();
  await expectError('23505', () => insert(sql, 'enrollments', { ...enrollmentRow, id: randomUUID(), class_id: secondClass }));
  assert.deepEqual(await revisions(), beforeConflict);
  await assert.rejects(() => client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe(guards.readGate.replace('FOR SHARE', 'FOR UPDATE'));
   await bound.unsafe('DELETE FROM ' + table('assessment_scores') + ' WHERE id=$1::uuid', [canonicalScore]);
   assert.deepEqual(await loadFixtureCompleteAssessment(bound, schema, scopeSelector, verifyIdentity), { ok: false, code: 'incomplete_source' });
   throw Error('intentional complete-source fixture rollback');
  }), error => error.message === 'intentional complete-source fixture rollback');
  assert.deepEqual(await revisions(), beforeConflict);
  assert.equal((await readCanonical()).ok, true);
  console.log('PASS: duplicate enrollment is constrained and missing second-pupil score rejects without poisoned revisions');

  await client.begin(async tx => {
   const verified = await readFixtureVerifiedCanonicalAssessment(wrap(tx), schema, scopeSelector, verifyIdentity);
   assert.equal(verified.ok, true, JSON.stringify(verified));
   await expectError('55P03', () => boundedWrite(other => other.unsafe('UPDATE ' + table('assessment_scores') + ' SET version=version+1 WHERE id=$1::uuid', [canonicalScore])));
   await expectError('55P03', () => boundedWrite(other => insert(other, 'enrollments', { ...enrollmentRow, id: randomUUID() })));
   await expectError('55P03', () => boundedWrite(other => other.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [ids.admin])));
  });
  await sql.unsafe('UPDATE ' + table('assessment_scores') + ' SET version=version+1 WHERE id=$1::uuid', [canonicalScore]);
  assert.deepEqual(await readCanonical(), { ok: false, code: 'incomplete_source' });
  console.log('PASS: canonical read holds source/authority locks and later second-pupil edits invalidate finalization');

  // Report proposal bindings are tested against the same verified relational
  // source. These rows are fixture-only, not a report writer or release endpoint.
  const reportSource = await seal();
  const reportRevision = (await revisions())[ids.scope];
  const reportA = randomUUID(), reportB = randomUUID(), snapshotA = randomUUID(), snapshotB = randomUUID();
  const reportRow = { id: reportA, school_id: ids.school, enrollment_id: ids.enrollment, student_id: ids.student, class_id: ids.class, session_id: ids.session, term_id: ids.term,
   assessment_scope_id: ids.scope, assessment_source_version_id: reportSource, assessment_revision: reportRevision, stage: 'approved', version: 3, submitted_by: ids.teacher, approved_by: ids.admin };
  await expectError('23503', () => insert(sql, 'report_cards', { ...reportRow, id: randomUUID(), enrollment_id: canonicalEnrollment }));
  await expectError('23503', () => insert(sql, 'report_cards', { ...reportRow, id: randomUUID(), class_id: secondClass }));
  await expectError('23503', () => insert(sql, 'report_cards', { ...reportRow, id: randomUUID(), assessment_source_version_id: ids.otherSource }));
  await expectError('23503', () => insert(sql, 'report_cards', { ...reportRow, id: randomUUID(), assessment_revision: reportRevision + 1 }));
  await insert(sql, 'report_cards', reportRow);
  await insert(sql, 'report_cards', { ...reportRow, id: reportB, student_id: ids.otherStudent, enrollment_id: canonicalEnrollment });
  console.log('PASS: report proposal rejects substituted enrollment/class and mismatched source scope/revision');

  const snapshotPayload = { format: 'greenfield.report-card.binding-fixture.v1', reportId: reportA, enrollmentId: ids.enrollment, sourceVersionId: reportSource, assessmentRevision: reportRevision };
  const reportSnapshotRow = { id: snapshotA, school_id: ids.school, report_id: reportA, report_version: 3, enrollment_id: ids.enrollment, assessment_scope_id: ids.scope,
   assessment_source_version_id: reportSource, assessment_revision: reportRevision, source_versions: [{ id: reportSource, revision: reportRevision }], canonical_payload: snapshotPayload,
   content_hash: createHash('sha256').update(canonicalizeSnapshotValue(snapshotPayload)).digest('hex') };
  await expectError('23503', () => insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: randomUUID(), enrollment_id: canonicalEnrollment }));
  await expectError('23503', () => insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: randomUUID(), assessment_source_version_id: ids.otherSource }));
  await expectError('23514', () => insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: randomUUID(), source_versions: [] }));
  await expectError('23514', () => insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: randomUUID(), content_hash: 'Z'.repeat(64) }));
  await insert(sql, 'report_card_snapshots', reportSnapshotRow);
  const secondSnapshotPayload = { ...snapshotPayload, reportId: reportB, enrollmentId: canonicalEnrollment };
  await insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: snapshotB, report_id: reportB, enrollment_id: canonicalEnrollment, canonical_payload: secondSnapshotPayload,
   content_hash: createHash('sha256').update(canonicalizeSnapshotValue(secondSnapshotPayload)).digest('hex') });
  await expectError('23505', () => insert(sql, 'report_card_snapshots', { ...reportSnapshotRow, id: randomUUID() }));
  await expectError('23514', () => sql.unsafe('UPDATE ' + table('report_cards') + ' SET approved_by=submitted_by WHERE id=$1::uuid', [reportA]));
  await expectError('23514', () => sql.unsafe('UPDATE ' + table('report_cards') + " SET stage='published' WHERE id=$1::uuid", [reportA]));
  console.log('PASS: report snapshots pin report enrollment/source and enforce version, JSON, hash and stage fields');

  const reportAuditRow = { id: randomUUID(), school_id: ids.school, report_id: reportA, actor_membership_id: ids.admin, action: 'approve', before_stage: 'submitted', after_stage: 'approved', before_version: 2, after_version: 3, snapshot_id: snapshotA, snapshot_report_version: 3 };
  await expectError('23503', () => insert(sql, 'report_card_audit', { ...reportAuditRow, snapshot_id: snapshotB }));
  await expectError('23514', () => insert(sql, 'report_card_audit', { ...reportAuditRow, snapshot_id: null }));
  await expectError('23514', () => insert(sql, 'report_card_audit', { ...reportAuditRow, after_stage: 'published' }));
  await insert(sql, 'report_card_audit', reportAuditRow);
  const reportReleaseRow = { id: randomUUID(), school_id: ids.school, report_id: reportA, report_version: 4, snapshot_id: snapshotA, snapshot_report_version: 3, published_by: ids.admin, released_at: '2026-10-19T10:00:00Z' };
  await expectError('23503', () => insert(sql, 'report_card_releases', { ...reportReleaseRow, report_id: reportB }));
  await expectError('23514', () => insert(sql, 'report_card_releases', { ...reportReleaseRow, report_version: 8 }));
  await expectError('23503', () => insert(sql, 'report_card_releases', { ...reportReleaseRow, snapshot_report_version: 99, report_version: 100 }));
  await expectError('23514', () => insert(sql, 'report_card_releases', { ...reportReleaseRow, revoked_at: '2000-01-01T00:00:00Z' }));
  console.log('PASS: report audit and release reject other-report snapshots, wrong approved versions and invalid transitions');

  for (const name of ['report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts']) {
   await sql.unsafe('CREATE TRIGGER fixture_append_only BEFORE UPDATE OR DELETE ON ' + table(name) + ' FOR EACH ROW EXECUTE FUNCTION ' + table('reject_append_only') + '()');
   await sql.unsafe('CREATE TRIGGER fixture_no_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('reject_append_only') + '()');
  }
  const reportReceiptRow = { school_id: ids.school, report_id: reportB, actor_membership_id: ids.admin, operation_key: 'reserved-report-key', fingerprint: hash, resulting_version: 3, outcome: { ok: true } };
  await insert(sql, 'report_card_operation_receipts', reportReceiptRow);
  const publishBindingFixture = operationKey => client.begin(async tx => {
   const bound = wrap(tx);
   const changed = await bound.unsafe('UPDATE ' + table('report_cards') + " SET stage='published',version=4,published_at=$2::timestamptz WHERE id=$1::uuid AND version=3 AND stage='approved' RETURNING id", [reportA, reportReleaseRow.released_at]);
   assert.equal(changed.length, 1);
   await insert(bound, 'report_card_audit', { ...reportAuditRow, id: randomUUID(), action: 'publish', before_stage: 'approved', after_stage: 'published', before_version: 3, after_version: 4 });
   await insert(bound, 'report_card_releases', reportReleaseRow);
   await insert(bound, 'report_card_operation_receipts', { ...reportReceiptRow, report_id: reportA, operation_key: operationKey, resulting_version: 4 });
  });
  await expectError('23505', () => publishBindingFixture('reserved-report-key'));
  const afterFailedPublication = (await sql.unsafe('SELECT stage,version,published_at FROM ' + table('report_cards') + ' WHERE id=$1::uuid', [reportA]))[0];
  assert.equal(afterFailedPublication.stage, 'approved'); assert.equal(afterFailedPublication.version, 3); assert.equal(afterFailedPublication.published_at, null);
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('report_card_releases')))[0].n, 0);
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('report_card_audit')))[0].n, 1);
  await publishBindingFixture('publish-report-binding-fixture');
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM ' + table('report_card_releases')))[0].n, 1);
  await expectError('23505', () => insert(sql, 'report_card_releases', { ...reportReleaseRow, id: randomUUID() }));
  for (const name of ['report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts']) {
   await expectError('P0001', () => sql.unsafe('UPDATE ' + table(name) + ' SET school_id=school_id'));
   await expectError('P0001', () => sql.unsafe('DELETE FROM ' + table(name)));
   await expectError('P0001', () => sql.unsafe('TRUNCATE ' + table(name) + ' CASCADE'));
  }
  console.log('PASS: report binding publication rolls back on receipt collision, retries once and preserves append-only records');

  // Actual fixture adapter, distinct from the earlier scripted binding helper.
  const writerPupils = [];
  for (let i=0; i<5; i++) {
   const pupil = { studentId:randomUUID(),enrollmentId:randomUUID(),reportId:randomUUID() };
   await insert(sql,'students',{ id:pupil.studentId,school_id:ids.school,admission_number:'FICTION-WRITER-'+i,first_name:'Fictional',last_name:'Writer-'+i });
   await insert(sql,'enrollments',{ id:pupil.enrollmentId,school_id:ids.school,student_id:pupil.studentId,class_id:ids.class,session_id:ids.session });
   await insert(sql,'assessment_scores',{ ...scoreRow,id:randomUUID(),roster_id:nextRoster,enrollment_id:pupil.enrollmentId,student_id:pupil.studentId,numeric_score:'75.0000' });
   writerPupils.push(pupil);
  }
  expectedPupilCount = 7;
  const writerSource = await seal(), writerRevision = (await revisions())[ids.scope];
  for (const pupil of writerPupils) await insert(sql,'report_cards',{ ...reportRow,id:pupil.reportId,enrollment_id:pupil.enrollmentId,student_id:pupil.studentId,assessment_source_version_id:writerSource,assessment_revision:writerRevision,stage:'submitted',version:2,approved_by:null });
  const adminAuth = (await sql.unsafe('SELECT auth_user_id FROM '+table('school_users')+' WHERE id=$1::uuid',[ids.adminUser]))[0].auth_user_id;
  const writerDb = { ...sql,begin: callback => client.begin(tx => callback(wrap(tx))) };
  const runWriter = (command,auth=adminAuth) => executeFixtureCanonicalReportCommand(writerDb,schema,command,async()=>({authUserId:auth}));
  const approveCommand = (pupil,key) => ({reportId:pupil.reportId,action:'approve',expectedVersion:2,operationKey:key});
  const publishCommand = (pupil,key) => ({reportId:pupil.reportId,action:'publish',expectedVersion:3,operationKey:key});
  const reportCount = async (name,pupil) => (await sql.unsafe('SELECT count(*)::int AS n FROM '+table(name)+' WHERE report_id=$1::uuid',[pupil.reportId]))[0].n;
  const firstWriter = writerPupils[0], firstApprove = approveCommand(firstWriter,'canonical-approve-1'), firstPublish = publishCommand(firstWriter,'canonical-publish-1');
  const approvals = await Promise.all([runWriter(firstApprove),runWriter(firstApprove)]);
  assert.equal(approvals.every(r=>r.ok),true,JSON.stringify(approvals)); assert.deepEqual(approvals.map(r=>r.kind).sort(),['applied','replay']);
  assert.equal(await reportCount('report_card_snapshots',firstWriter),1);
  assert.deepEqual(await runWriter({...firstApprove,expectedVersion:3}),{ok:false,code:'idempotency_conflict'});
  const publications = await Promise.all([runWriter(firstPublish),runWriter(firstPublish)]);
  assert.equal(publications.every(r=>r.ok),true,JSON.stringify(publications)); assert.deepEqual(publications.map(r=>r.kind).sort(),['applied','replay']);
  assert.equal(publications[0].snapshotId,approvals[0].snapshotId); assert.equal(await reportCount('report_card_releases',firstWriter),1);
  const storedApproved = (await sql.unsafe('SELECT canonical_payload FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[approvals[0].snapshotId]))[0].canonical_payload;
  assert.equal(storedApproved.format,'greenfield.report-card.approved-snapshot.v1'); assert.equal(storedApproved.subjects[0].result.total,'75.00');
  assert.equal(JSON.stringify(storedApproved).includes(canonicalEnrollment),false);
  console.log('PASS: actual canonical report writer serializes approval/publication, replays and pins one pupil snapshot');

  const retryApproval = writerPupils[1], retryApproveCommand = approveCommand(retryApproval,'canonical-approve-retry');
  assert.deepEqual(await runWriter(retryApproveCommand,authUser),{ok:false,code:'forbidden'});
  await sql.unsafe('UPDATE '+table('memberships')+" SET status='suspended' WHERE id=$1::uuid",[ids.admin]);
  try { assert.deepEqual(await runWriter(retryApproveCommand),{ok:false,code:'forbidden'}); }
  finally { await sql.unsafe('UPDATE '+table('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.admin]); }
  await sql.unsafe('UPDATE '+table('report_cards')+' SET assessment_source_version_id=$2::uuid,assessment_revision=1 WHERE id=$1::uuid',[retryApproval.reportId,ids.source]);
  assert.deepEqual(await runWriter(retryApproveCommand),{ok:false,code:'stale_source'});
  await sql.unsafe('UPDATE '+table('report_cards')+' SET assessment_source_version_id=$2::uuid,assessment_revision=$3 WHERE id=$1::uuid',[retryApproval.reportId,writerSource,writerRevision]);
  assert.equal(await reportCount('report_card_snapshots',retryApproval),0);
  console.log('PASS: canonical report writer rejects teacher, suspended actor and stale pinned source without writes');

  await sql.unsafe('CREATE FUNCTION '+table('fixture_fail_report_writer')+"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.report_id::text = TG_ARGV[0] THEN RAISE EXCEPTION 'injected canonical report fixture failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$");
  const failWriter = (name,pupil) => sql.unsafe('CREATE TRIGGER fixture_fail_writer_insert BEFORE INSERT ON '+table(name)+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_fail_report_writer')+"('"+pupil.reportId+"')");
  const clearWriterFailure = name => sql.unsafe('DROP TRIGGER fixture_fail_writer_insert ON '+table(name));
  for (const name of ['report_card_snapshots','report_card_audit','report_card_operation_receipts']) {
   await failWriter(name,retryApproval);
   try { assert.deepEqual(await runWriter(retryApproveCommand),{ok:false,code:'transaction_failed'}); }
   finally { await clearWriterFailure(name); }
   const state = (await sql.unsafe('SELECT stage,version FROM '+table('report_cards')+' WHERE id=$1::uuid',[retryApproval.reportId]))[0];
   assert.equal(state.stage,'submitted'); assert.equal(state.version,2);
   for (const relation of ['report_card_snapshots','report_card_audit','report_card_operation_receipts']) assert.equal(await reportCount(relation,retryApproval),0);
  }
  assert.equal((await runWriter(retryApproveCommand)).ok,true);
  assert.equal((await runWriter(retryApproveCommand)).kind,'replay');
  console.log('PASS: canonical approval rolls back snapshot/audit/receipt errors and retries the same operation key');

  const retryPublication = writerPupils[2], retryPublishCommand = publishCommand(retryPublication,'canonical-publish-retry');
  const approvedForRetry = await runWriter(approveCommand(retryPublication,'canonical-approve-publish-retry')); assert.equal(approvedForRetry.ok,true,JSON.stringify(approvedForRetry));
  for (const name of ['report_card_releases','report_card_operation_receipts']) {
   await failWriter(name,retryPublication);
   try { assert.deepEqual(await runWriter(retryPublishCommand),{ok:false,code:'transaction_failed'}); }
   finally { await clearWriterFailure(name); }
   const state = (await sql.unsafe('SELECT stage,version FROM '+table('report_cards')+' WHERE id=$1::uuid',[retryPublication.reportId]))[0];
   assert.equal(state.stage,'approved'); assert.equal(state.version,3); assert.equal(await reportCount('report_card_releases',retryPublication),0);
   assert.equal(await reportCount('report_card_audit',retryPublication),1); assert.equal(await reportCount('report_card_operation_receipts',retryPublication),1);
  }
  const publishedForRetry = await runWriter(retryPublishCommand); assert.equal(publishedForRetry.ok,true,JSON.stringify(publishedForRetry));
  assert.equal(publishedForRetry.snapshotId,approvedForRetry.snapshotId); assert.equal((await runWriter(retryPublishCommand)).kind,'replay'); assert.equal(await reportCount('report_card_releases',retryPublication),1);
  console.log('PASS: canonical publication rolls back release/receipt errors and reuses the approved snapshot on retry');

  const tamperPupil = writerPupils[3], tamperDocs = await readCanonical(); assert.equal(tamperDocs.ok,true,JSON.stringify(tamperDocs));
  const tamperBinding = {id:tamperPupil.reportId,schoolId:ids.school,enrollmentId:tamperPupil.enrollmentId,studentId:tamperPupil.studentId,classId:ids.class,sessionId:ids.session,termId:ids.term,assessmentScopeId:ids.scope,assessmentSourceVersionId:writerSource,assessmentRevision:writerRevision,approvedVersion:3,submittedBy:ids.teacher,approvedBy:ids.admin,approvedAt:new Date().toISOString()};
  const intended = buildApprovedReportSnapshot(tamperBinding,tamperDocs.documents); assert.equal(intended.ok,true,JSON.stringify(intended));
  const poisoned = JSON.parse(intended.snapshot.canonicalJson); poisoned.subjects[0].result.total='100.00';
  await insert(sql,'report_card_snapshots',{...reportSnapshotRow,id:randomUUID(),report_id:tamperPupil.reportId,enrollment_id:tamperPupil.enrollmentId,assessment_source_version_id:writerSource,assessment_revision:writerRevision,source_versions:intended.snapshot.sourceVersions,canonical_payload:poisoned,content_hash:createHash('sha256').update(canonicalizeSnapshotValue(poisoned)).digest('hex')});
  await sql.unsafe('UPDATE '+table('report_cards')+" SET stage='approved',version=3,approved_by=$2::uuid WHERE id=$1::uuid",[tamperPupil.reportId,ids.admin]);
  assert.deepEqual(await runWriter(publishCommand(tamperPupil,'canonical-tamper-publish')),{ok:false,code:'snapshot_mismatch'});
  assert.equal(await reportCount('report_card_releases',tamperPupil),0);
  // Force the actual writer to pause after its report update, while its source
  // and authority locks are still held, then attempt a competing score edit.
  const barrierPupil = writerPupils[4], barrierCommand = approveCommand(barrierPupil,'canonical-barrier-approve');
  const barrierKey = randomBytes(4).readUInt32BE(0) % 1000000000;
  await sql.unsafe('CREATE FUNCTION '+table('fixture_report_writer_barrier')+"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.report_id::text = TG_ARGV[0] THEN PERFORM pg_advisory_xact_lock(TG_ARGV[1]::bigint); END IF; RETURN NEW; END $$");
  await sql.unsafe('CREATE TRIGGER fixture_writer_barrier BEFORE INSERT ON '+table('report_card_audit')+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_report_writer_barrier')+"('"+barrierPupil.reportId+"','"+barrierKey+"')");
  let pendingWriter;
  await client.begin(async control => {
   await wrap(control).unsafe('SELECT pg_advisory_xact_lock($1::bigint)',[barrierKey]);
   pendingWriter = runWriter(barrierCommand);
   let waiting = false;
   for (let attempt=0; attempt<100; attempt++) {
    const locks = await sql.unsafe("SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND classid=0 AND objid=$1::oid AND NOT granted",[barrierKey]);
    if (locks[0].n>0) {waiting=true;break;} await new Promise(resolve=>setTimeout(resolve,20));
   }
   assert.equal(waiting,true,'canonical writer did not reach audit barrier');
   await expectError('55P03',()=>boundedWrite(other=>other.unsafe('UPDATE '+table('assessment_scores')+' SET version=version+1 WHERE id=$1::uuid',[canonicalScore])));
  });
  const completedWriter = await pendingWriter; assert.equal(completedWriter.ok,true,JSON.stringify(completedWriter));
  await sql.unsafe('DROP TRIGGER fixture_writer_barrier ON '+table('report_card_audit'));
  await sql.unsafe('UPDATE '+table('assessment_scores')+' SET version=version+1 WHERE id=$1::uuid',[canonicalScore]);
  assert.deepEqual(await runWriter(publishCommand(barrierPupil,'canonical-stale-publish')),{ok:false,code:'incomplete_source'});
  assert.equal((await runWriter(barrierCommand)).kind,'replay'); assert.equal(await reportCount('report_card_releases',barrierPupil),0);
  console.log('PASS: actual writer rejects forged snapshots, blocks interleaved source edits and preserves historical replay');

  const workflowPupils=[];
  for(let i=0;i<4;i++){
   const pupil={studentId:randomUUID(),enrollmentId:randomUUID()};
   await insert(sql,'students',{id:pupil.studentId,school_id:ids.school,admission_number:'FICTION-WORKFLOW-'+i,first_name:'Fictional',last_name:'Workflow-'+i});
   await insert(sql,'enrollments',{id:pupil.enrollmentId,school_id:ids.school,student_id:pupil.studentId,class_id:ids.class,session_id:ids.session});
   await insert(sql,'assessment_scores',{...scoreRow,id:randomUUID(),roster_id:nextRoster,enrollment_id:pupil.enrollmentId,student_id:pupil.studentId,numeric_score:'75.0000'});
   workflowPupils.push(pupil);
  }
  expectedPupilCount=11;await seal();
  const runWorkflow=(command,auth=authUser)=>executeFixtureReportWorkflow(writerDb,schema,command,async()=>({authUserId:auth}));
  const createCommand=(pupil,key)=>({action:'create',studentId:pupil.studentId,enrollmentId:pupil.enrollmentId,classId:ids.class,sessionId:ids.session,termId:ids.term,operationKey:key});
  const firstCreation=createCommand(workflowPupils[0],'workflow-create-first');
  const creations=await Promise.all([runWorkflow(firstCreation),runWorkflow(firstCreation)]);
  assert.equal(creations.every(r=>r.ok),true,JSON.stringify(creations));assert.deepEqual(creations.map(r=>r.kind).sort(),['applied','replay']);
  const firstWorkflow={...workflowPupils[0],reportId:creations[0].reportId};
  assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+table('report_cards')+' WHERE student_id=$1::uuid',[firstWorkflow.studentId]))[0].n,1);
  const crossActor=await Promise.all([runWorkflow(createCommand(workflowPupils[1],'workflow-create-teacher')),runWorkflow(createCommand(workflowPupils[1],'workflow-create-admin'),adminAuth)]);
  assert.equal(crossActor.filter(r=>r.ok).length,1,JSON.stringify(crossActor));assert.equal(crossActor.find(r=>!r.ok).code,'duplicate_report');
  const secondWorkflow={...workflowPupils[1],reportId:crossActor.find(r=>r.ok).reportId};
  const creationAudit=(await sql.unsafe('SELECT action,before_version,after_version FROM '+table('report_card_audit')+" WHERE report_id=$1::uuid AND action='create'",[firstWorkflow.reportId]))[0];
  assert.equal(creationAudit.before_version,0);assert.equal(creationAudit.after_version,1);
  console.log('PASS: persisted creation serializes actor retries and cross-actor duplicate identities with a version-zero audit');

  const firstSubmission={action:'submit',reportId:firstWorkflow.reportId,expectedVersion:1,operationKey:'workflow-submit-first'};
  const submissions=await Promise.all([runWorkflow(firstSubmission),runWorkflow(firstSubmission)]);
  assert.equal(submissions.every(r=>r.ok),true,JSON.stringify(submissions));assert.deepEqual(submissions.map(r=>r.kind).sort(),['applied','replay']);
  const firstReturn={action:'return',reportId:firstWorkflow.reportId,expectedVersion:2,operationKey:'workflow-return-first',reason:'  Review the result  '};
  assert.equal((await runWorkflow(firstReturn,adminAuth)).ok,true);
  assert.equal((await runWorkflow({action:'submit',reportId:firstWorkflow.reportId,expectedVersion:3,operationKey:'workflow-resubmit-first'})).ok,true);
  const beforeReopenApproval=await runWriter({reportId:firstWorkflow.reportId,action:'approve',expectedVersion:4,operationKey:'workflow-approve-first'});assert.equal(beforeReopenApproval.ok,true,JSON.stringify(beforeReopenApproval));
  const oldWorkflowSnapshot=(await sql.unsafe('SELECT id,content_hash,assessment_source_version_id FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[beforeReopenApproval.snapshotId]))[0];
  assert.equal((await runWorkflow({action:'reopen',reportId:firstWorkflow.reportId,expectedVersion:5,operationKey:'workflow-reopen-first'},adminAuth)).ok,true);
  const retainedReason=(await sql.unsafe('SELECT reason FROM '+table('report_card_audit')+" WHERE report_id=$1::uuid AND action='return'",[firstWorkflow.reportId]))[0].reason;
  assert.equal(retainedReason,'Review the result');assert.equal((await sql.unsafe('SELECT return_reason FROM '+table('report_cards')+' WHERE id=$1::uuid',[firstWorkflow.reportId]))[0].return_reason,null);
  assert.equal(await reportCount('report_card_snapshots',firstWorkflow),1);
  console.log('PASS: persisted submission, return, resubmission, approval and reopen preserve immutable reason and snapshot history');

  assert.equal((await runWorkflow({action:'submit',reportId:secondWorkflow.reportId,expectedVersion:1,operationKey:'workflow-submit-second'})).ok,true);
  await sql.unsafe('UPDATE '+table('assessment_scores')+' SET version=version+1 WHERE id=$1::uuid',[canonicalScore]);
  assert.equal((await runWorkflow({action:'return',reportId:secondWorkflow.reportId,expectedVersion:2,operationKey:'workflow-return-stale',reason:'Recheck source'},adminAuth)).ok,true);
  assert.deepEqual(await runWorkflow({action:'submit',reportId:secondWorkflow.reportId,expectedVersion:3,operationKey:'workflow-resubmit-second'}),{ok:false,code:'incomplete_source'});
  const refreshedWorkflowSource=await seal();
  assert.equal((await runWorkflow({action:'submit',reportId:firstWorkflow.reportId,expectedVersion:6,operationKey:'workflow-submit-refreshed'})).ok,true);
  assert.equal((await runWorkflow({action:'submit',reportId:secondWorkflow.reportId,expectedVersion:3,operationKey:'workflow-resubmit-second'})).ok,true);
  assert.equal((await sql.unsafe('SELECT assessment_source_version_id FROM '+table('report_cards')+' WHERE id=$1::uuid',[firstWorkflow.reportId]))[0].assessment_source_version_id,refreshedWorkflowSource);
  assert.deepEqual((await sql.unsafe('SELECT id,content_hash,assessment_source_version_id FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[oldWorkflowSnapshot.id]))[0],oldWorkflowSnapshot);
  const refreshedApproval=await runWriter({reportId:firstWorkflow.reportId,action:'approve',expectedVersion:7,operationKey:'workflow-approve-refreshed'});assert.equal(refreshedApproval.ok,true,JSON.stringify(refreshedApproval));
  assert.notEqual(refreshedApproval.snapshotId,oldWorkflowSnapshot.id);assert.equal(await reportCount('report_card_snapshots',firstWorkflow),2);
  assert.equal((await runWriter({reportId:firstWorkflow.reportId,action:'publish',expectedVersion:8,operationKey:'workflow-publish-refreshed'})).ok,true);
  assert.equal((await runWorkflow(firstCreation)).kind,'replay');assert.equal((await runWorkflow(firstSubmission)).kind,'replay');
  assert.deepEqual(await runWorkflow({action:'reopen',reportId:firstWorkflow.reportId,expectedVersion:9,operationKey:'workflow-reopen-published'},adminAuth),{ok:false,code:'invalid_transition'});
  console.log('PASS: submission refreshes a complete current source while stale recovery, old snapshots and historical replay remain safe');

  await sql.unsafe('CREATE FUNCTION '+table('fixture_fail_report_workflow')+"() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE pupil uuid; payload jsonb; BEGIN payload:=to_jsonb(NEW); IF TG_TABLE_NAME='report_cards' THEN pupil:=(payload->>'student_id')::uuid; ELSE SELECT student_id INTO pupil FROM "+table('report_cards')+" WHERE id=(payload->>'report_id')::uuid; END IF; IF pupil::text=TG_ARGV[0] THEN RAISE EXCEPTION 'injected report workflow fixture failure' USING ERRCODE='P0001'; END IF; RETURN NEW; END $$");
  const failWorkflow=(name,pupil)=>sql.unsafe('CREATE TRIGGER fixture_fail_workflow_insert BEFORE INSERT ON '+table(name)+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_fail_report_workflow')+"('"+pupil.studentId+"')");
  const clearWorkflow=name=>sql.unsafe('DROP TRIGGER fixture_fail_workflow_insert ON '+table(name));
  const retryWorkflowPupil=workflowPupils[2],retryCreation=createCommand(retryWorkflowPupil,'workflow-create-retry');
  for(const name of ['report_cards','report_card_audit','report_card_operation_receipts']){
   await failWorkflow(name,retryWorkflowPupil);
   try{assert.deepEqual(await runWorkflow(retryCreation),{ok:false,code:'transaction_failed'});}finally{await clearWorkflow(name);}
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM '+table('report_cards')+' WHERE student_id=$1::uuid',[retryWorkflowPupil.studentId]))[0].n,0);
  }
  const retryCreated=await runWorkflow(retryCreation);assert.equal(retryCreated.ok,true,JSON.stringify(retryCreated));retryWorkflowPupil.reportId=retryCreated.reportId;
  const transitionState=async pupil=>({row:(await sql.unsafe('SELECT stage,version,return_reason,assessment_source_version_id,assessment_revision FROM '+table('report_cards')+' WHERE id=$1::uuid',[pupil.reportId]))[0],audit:await reportCount('report_card_audit',pupil),receipts:await reportCount('report_card_operation_receipts',pupil),snapshots:await reportCount('report_card_snapshots',pupil)});
  const failTransition=async(command,auth)=>{
   const before=await transitionState(retryWorkflowPupil);
   for(const name of ['report_card_audit','report_card_operation_receipts']){
    await failWorkflow(name,retryWorkflowPupil);try{assert.deepEqual(await runWorkflow(command,auth),{ok:false,code:'transaction_failed'});}finally{await clearWorkflow(name);}
    assert.deepEqual(await transitionState(retryWorkflowPupil),before);
   }
   assert.equal((await runWorkflow(command,auth)).ok,true);assert.equal((await runWorkflow(command,auth)).kind,'replay');
  };
  await failTransition({action:'submit',reportId:retryCreated.reportId,expectedVersion:1,operationKey:'workflow-submit-retry'},authUser);
  await failTransition({action:'return',reportId:retryCreated.reportId,expectedVersion:2,operationKey:'workflow-return-retry',reason:'Review'},adminAuth);
  assert.equal((await runWorkflow({action:'submit',reportId:retryCreated.reportId,expectedVersion:3,operationKey:'workflow-resubmit-retry'})).ok,true);
  assert.equal((await runWriter({reportId:retryCreated.reportId,action:'approve',expectedVersion:4,operationKey:'workflow-approve-retry'})).ok,true);
  await failTransition({action:'reopen',reportId:retryCreated.reportId,expectedVersion:5,operationKey:'workflow-reopen-retry'},adminAuth);
  console.log('PASS: creation and every persisted correction transition roll back audit/receipt failures and retry without orphan state');

  const guardPupil=workflowPupils[3],guardCreation=createCommand(guardPupil,'workflow-shared-family-key');
  await sql.unsafe('UPDATE '+table('teacher_class_assignments')+' SET ended_at=now() WHERE id=$1::uuid',[ids.assignment]);
  try{assert.deepEqual(await runWorkflow(guardCreation),{ok:false,code:'forbidden'});}finally{await sql.unsafe('UPDATE '+table('teacher_class_assignments')+' SET ended_at=NULL WHERE id=$1::uuid',[ids.assignment]);}
  assert.deepEqual(await runWorkflow({...guardCreation,enrollmentId:randomUUID(),operationKey:'workflow-foreign-enrollment'}),{ok:false,code:'invalid_reference'});
  assert.deepEqual(await runWorkflow({action:'return',reportId:secondWorkflow.reportId,expectedVersion:4,operationKey:'workflow-teacher-return',reason:'Review'}),{ok:false,code:'forbidden'});
  assert.deepEqual(await runWorkflow({action:'return',reportId:secondWorkflow.reportId,expectedVersion:4,operationKey:'workflow-empty-return',reason:' '},adminAuth),{ok:false,code:'invalid'});
  const guardCreated=await runWorkflow(guardCreation,adminAuth);assert.equal(guardCreated.ok,true,JSON.stringify(guardCreated));guardPupil.reportId=guardCreated.reportId;
  const guardSubmission={action:'submit',reportId:guardCreated.reportId,expectedVersion:1,operationKey:'workflow-guard-submit'};
  assert.deepEqual(await runWorkflow(guardSubmission,adminAuth),{ok:false,code:'forbidden'});assert.equal((await runWorkflow(guardSubmission)).ok,true);
  assert.deepEqual(await runWriter({reportId:guardCreated.reportId,action:'approve',expectedVersion:2,operationKey:'workflow-shared-family-key'}),{ok:false,code:'idempotency_conflict'});
  assert.equal((await runWriter({reportId:guardCreated.reportId,action:'approve',expectedVersion:2,operationKey:'workflow-guard-approve'})).ok,true);
  assert.equal((await runWriter({reportId:guardCreated.reportId,action:'publish',expectedVersion:3,operationKey:'workflow-guard-publish'})).ok,true);
  const originalGuardPublication=(await sql.unsafe('SELECT published_at FROM '+table('report_cards')+' WHERE id=$1::uuid',[guardCreated.reportId]))[0].published_at;
  await sql.unsafe('UPDATE '+table('report_cards')+" SET stage='approved',published_at=NULL WHERE id=$1::uuid",[guardCreated.reportId]);
  try{assert.deepEqual(await runWorkflow({action:'reopen',reportId:guardCreated.reportId,expectedVersion:4,operationKey:'workflow-active-release'},adminAuth),{ok:false,code:'active_release'});}finally{await sql.unsafe('UPDATE '+table('report_cards')+" SET stage='published',published_at=$2::timestamptz WHERE id=$1::uuid",[guardCreated.reportId,originalGuardPublication]);}
  const restoredGuardPublication=await sql.unsafe('SELECT r.published_at=l.released_at AS matches FROM '+table('report_cards')+' r JOIN '+table('report_card_releases')+' l ON l.school_id=r.school_id AND l.report_id=r.id AND l.revoked_at IS NULL WHERE r.id=$1::uuid',[guardCreated.reportId]);
  assert.equal(restoredGuardPublication.length,1);assert.equal(restoredGuardPublication[0].matches,true,'guard fixture must restore the exact original publication timestamp');
  await expectError('23514',()=>insert(sql,'report_card_audit',{...reportAuditRow,id:randomUUID(),report_id:guardCreated.reportId,action:'create',before_stage:'draft',after_stage:'draft',before_version:1,after_version:2,snapshot_id:null,snapshot_report_version:null}));
  await expectError('23514',()=>insert(sql,'report_card_audit',{...reportAuditRow,id:randomUUID(),report_id:guardCreated.reportId,action:'return',before_stage:'submitted',after_stage:'returned',before_version:2,after_version:3,snapshot_id:null,snapshot_report_version:null,reason:null}));
  console.log('PASS: workflow roles, assignment, cross-family keys, active release and immutable creation/return audit guards fail closed');






  // Install after earlier revision assertions: this batch changes lock ordering only.
  const authorityGuards = assessmentAuthorityGuardDDL(schema);
  for (const statement of authorityGuards.statements) await sql.unsafe(statement);
  await client.begin(async tx => {
   await wrap(tx).unsafe(guards.readGate);
   for (const name of authorityGuards.targets) {
    // Even zero-row statements must wait before discovery or row acquisition.
    for (const statement of [
     'INSERT INTO '+table(name)+' SELECT * FROM '+table(name)+' WHERE false',
     'UPDATE '+table(name)+' SET id=id WHERE false',
     'DELETE FROM '+table(name)+' WHERE false',
    ]) await expectError('55P03',()=>boundedWrite(other=>other.unsafe(statement)));
   }
  });
  console.log('PASS: every authority and parent insert/update/delete takes discovery gate before row discovery');
  await sql.unsafe('UPDATE '+table('memberships')+" SET status='suspended' WHERE id=$1::uuid",[ids.teacher]);
  try { assert.deepEqual(await runWorkflow(createCommand(guardPupil,'authority-suspended-create')),{ok:false,code:'forbidden'}); }
  finally { await sql.unsafe('UPDATE '+table('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.teacher]); }
  for (const name of authorityGuards.targets) await expectError('P0001',()=>sql.unsafe('TRUNCATE '+table(name)+' CASCADE'));
  console.log('PASS: authority changes complete after reader release, subsequent commands recheck membership and parent truncate is blocked');

  const sessionParentScopes=[ids.scope,secondTermScope,destinationScope,newScope];
  const allParentScopes=[...sessionParentScopes,ids.otherScope];
  const parentCases=[
   ['schools',ids.school,allParentScopes],
   ['students',ids.student,[ids.scope,secondTermScope]],
   ['classes',ids.class,[ids.scope,secondTermScope,ids.otherScope]],
   ['academic_levels',ids.level,allParentScopes],
   ['academic_sections',ids.section,[ids.scope,secondTermScope,ids.otherScope]],
   ['academic_sessions',ids.session,sessionParentScopes],
   ['terms',ids.term,[ids.scope,destinationScope]],
  ];
  const parentRollback=Error('intentional fixture parent rollback');
  for (const [name,id,affected] of parentCases) {
   const before=await revisions();
   await assert.rejects(client.begin(async tx=>{
    const bound=wrap(tx);
    await bound.unsafe('UPDATE '+table(name)+' SET id=id WHERE id=$1::uuid',[id]);
    const after=Object.fromEntries((await bound.unsafe('SELECT id,revision FROM '+table('assessment_scopes'))).map(row=>[row.id,row.revision]));
    assertIncrement(before,after,affected);
    throw parentRollback;
   }),error=>error===parentRollback);
   assert.deepEqual(await revisions(),before);
  }
  console.log('PASS: seven academic parent families invalidate exactly their dependent class/session/term scopes and roll back');

  const beforeParentFailure=await revisions();
  const beforeSchool=await sql.unsafe('SELECT final_primary_year FROM '+table('schools')+' WHERE id=$1::uuid',[ids.school]);
  await expectError('23505',()=>client.begin(async tx=>{
   const bound=wrap(tx);
   await bound.unsafe('UPDATE '+table('schools')+' SET final_primary_year=6 WHERE id=$1::uuid',[ids.school]);
   await bound.unsafe('UPDATE '+table('academic_levels')+' SET id=id WHERE id=$1::uuid',[ids.level]);
   await bound.unsafe('UPDATE '+table('assessment_scores')+' SET version=version+1 WHERE id=$1::uuid',[editableScore]);
   const after=Object.fromEntries((await bound.unsafe('SELECT id,revision FROM '+table('assessment_scopes'))).map(row=>[row.id,row.revision]));
   assertIncrement(beforeParentFailure,after,allParentScopes);
   await insert(bound,'assessment_operation_receipts',receiptRow);
  }));
  assert.deepEqual(await revisions(),beforeParentFailure);
  assert.deepEqual(await sql.unsafe('SELECT final_primary_year FROM '+table('schools')+' WHERE id=$1::uuid',[ids.school]),beforeSchool);
  console.log('PASS: parent and score writes share once-per-transaction revision claims; receipt collision rolls back parent data and fan-out');

  await seal();
  assert.equal((await readCanonical()).ok,true);
  const historyBeforeParent=await sql.unsafe('SELECT id,content_hash,canonical_payload FROM '+table('report_card_snapshots')+' ORDER BY id');
  const beforeParentCommit=await revisions();
  await client.begin(async tx=>{
   const bound=wrap(tx);
   await bound.unsafe('UPDATE '+table('schools')+' SET final_primary_year=6 WHERE id=$1::uuid',[ids.school]);
   await bound.unsafe('UPDATE '+table('academic_levels')+' SET id=id WHERE id=$1::uuid',[ids.level]);
   await bound.unsafe('UPDATE '+table('schools')+' SET final_primary_year=6 WHERE id=$1::uuid',[ids.school]);
  });
  assert.equal((await sql.unsafe('SELECT final_primary_year FROM '+table('schools')+' WHERE id=$1::uuid',[ids.school]))[0].final_primary_year,6);
  assertIncrement(beforeParentCommit,await revisions(),allParentScopes);
  assert.equal((await readCanonical()).ok,false);
  await seal();
  assert.equal((await readCanonical()).ok,true);
  assert.deepEqual(await sql.unsafe('SELECT id,content_hash,canonical_payload FROM '+table('report_card_snapshots')+' ORDER BY id'),historyBeforeParent);
  const beforeAuthorityOnly=await revisions();
  await sql.unsafe('UPDATE '+table('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.teacher]);
  assert.deepEqual(await revisions(),beforeAuthorityOnly);
  console.log('PASS: committed parent edits stale the source, fresh canonical finalization recovers and immutable report snapshots remain unchanged');

  if(testRestrictedRoles) {
   const securityPupil={studentId:randomUUID(),enrollmentId:randomUUID()};
   const failurePupil={studentId:randomUUID(),enrollmentId:randomUUID()};
   for(const [index,pupil] of [securityPupil,failurePupil].entries()) {
    await insert(sql,'students',{id:pupil.studentId,school_id:ids.school,admission_number:'FICTION-SECURITY-'+index,first_name:'Fictional',last_name:'Security'});
    await insert(sql,'enrollments',{id:pupil.enrollmentId,school_id:ids.school,student_id:pupil.studentId,class_id:ids.class,session_id:ids.session});
    await insert(sql,'assessment_scores',{...scoreRow,id:randomUUID(),roster_id:nextRoster,enrollment_id:pupil.enrollmentId,student_id:pupil.studentId});
    expectedPupilCount+=1;
   }
   await seal();
   const security=fixtureSecurityPlan(schema,ids.school), rolePreflight=fixtureRolePreflightPlan(schema);
   const rollbackSecurity=Error('intentional rollback of temporary roles and policies');
   await assert.rejects(client.begin(async tx=>{
    const bound=wrap(tx);
    for(const role of Object.values(security.roles)) await bound.unsafe('CREATE ROLE '+q(role)+' NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
    await bound.unsafe('GRANT '+Object.values(security.roles).map(q).join(',')+' TO CURRENT_USER WITH SET TRUE');
    const evidence=await bound.unsafe(rolePreflight.query,rolePreflight.parameters);
    assert.equal(inspectFixtureRestrictedRoles(schema,evidence).ok,true);
    // Test-only failure switch. It confers no privilege and supplies no identity.
    const failureSetting=schema+'.fail_relation';
    await bound.unsafe(`CREATE FUNCTION ${table('fixture_restricted_insert_failure')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('${schema}.fail_relation',true)=TG_TABLE_NAME THEN
  RAISE EXCEPTION 'injected restricted writer failure' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$`);
    const reportRelations=['report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases'];
    for(const name of reportRelations) await bound.unsafe('CREATE TRIGGER fixture_restricted_insert_failure BEFORE INSERT ON '+table(name)+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_restricted_insert_failure')+'()');
    for(const name of ['report_cards','report_card_releases']) await bound.unsafe('CREATE TRIGGER fixture_restricted_update_failure BEFORE UPDATE ON '+table(name)+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_restricted_insert_failure')+'()');
    for(const statement of security.statements) await bound.unsafe(statement);
    const asRole=async role=>{
     await bound.unsafe('SET LOCAL ROLE '+q(role));
     const current=await bound.unsafe('SELECT current_user AS name');assert.equal(current[0].name,role);
    };
    const denied=work=>expectError('42501',()=>tx.savepoint(inner=>work(wrap(inner))));
    await asRole(security.roles.reader);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('schools')+' WHERE id=$1::uuid',[ids.school])).length,1);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('schools')+' WHERE id=$1::uuid',[ids.foreignSchool])).length,0);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('assessment_subjects')+' WHERE id=$1::uuid',[ids.foreignSubject])).length,0);
    await bound.unsafe("SELECT pg_catalog.set_config('app.school_id',$1,true)",[ids.foreignSchool]);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('schools')+' WHERE id=$1::uuid',[ids.foreignSchool])).length,0);
    console.log('PASS: restricted role preflight, exact execution role and forced school RLS reject foreign rows and forged session scope');

    assert.equal((await bound.unsafe('SELECT id FROM '+table('assessment_scores')+' WHERE id=$1::uuid FOR SHARE',[editableScore])).length,1);
    assert.equal((await readFixtureVerifiedCanonicalAssessment(bound,schema,scopeSelector,verifyIdentity)).ok,true);
    for(const name of security.targets) await denied(other=>other.unsafe('UPDATE '+table(name)+' SET id=id WHERE false'));
    await denied(other=>insert(other,'report_cards',{...reportRow,id:randomUUID()}));
    await denied(other=>other.unsafe('TRUNCATE '+table('report_cards')));
    await denied(other=>other.unsafe('SELECT '+table('fixture_mark_source_scope')+'($1::uuid)',[ids.scope]));
    console.log('PASS: restricted reader performs actual canonical locking reads but cannot mutate any fixture relation or call revision helpers');

    await asRole(security.roles.writer);
    for(const name of security.targets.filter(name=>name!=='report_cards')) await denied(other=>other.unsafe('UPDATE '+table(name)+' SET id=id WHERE false'));
    await denied(other=>other.unsafe('UPDATE '+table('report_cards')+' SET school_id=$1::uuid WHERE false',[ids.foreignSchool]));
    await denied(other=>other.unsafe('DELETE FROM '+table('report_card_snapshots')+' WHERE false'));
    await denied(other=>insert(other,'report_cards',{...reportRow,id:randomUUID(),school_id:ids.foreignSchool}));
    const restrictedDb={begin:callback=>tx.savepoint(async inner=>{
     const execution=wrap(inner),current=await execution.unsafe('SELECT current_user AS name');
     assert.equal(current[0].name,security.roles.writer);
     return callback(execution);
    })};
    const command=createCommand(securityPupil,'restricted-create');
    const created=await executeFixtureReportWorkflow(restrictedDb,schema,command,verifyIdentity);
    assert.equal(created.ok,true,JSON.stringify(created));
    assert.equal((await executeFixtureReportWorkflow(restrictedDb,schema,command,verifyIdentity)).kind,'replay');
    const submit={action:'submit',reportId:created.reportId,expectedVersion:1,operationKey:'restricted-submit'};
    assert.equal((await executeFixtureReportWorkflow(restrictedDb,schema,submit,verifyIdentity)).ok,true);
    const approve={action:'approve',reportId:created.reportId,expectedVersion:2,operationKey:'restricted-approve'};
    assert.deepEqual(await executeFixtureCanonicalReportCommand(restrictedDb,schema,approve,verifyIdentity),{ok:false,code:'forbidden'});
    const verifyAdmin=async()=>({authUserId:adminAuth});
    assert.equal((await executeFixtureCanonicalReportCommand(restrictedDb,schema,approve,verifyAdmin)).ok,true);
    const publish={action:'publish',reportId:created.reportId,expectedVersion:3,operationKey:'restricted-publish'};
    assert.equal((await executeFixtureCanonicalReportCommand(restrictedDb,schema,publish,verifyAdmin)).ok,true);
    assert.equal((await executeFixtureCanonicalReportCommand(restrictedDb,schema,publish,verifyAdmin)).kind,'replay');
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid',[created.reportId])).length,1);
    console.log('PASS: restricted writer runs actual create/submit/approve/publish and replay while academic, identity and immutable updates are denied');
    const restrictedState=async()=>{
     const state={};
     for(const name of reportRelations) state[name]=await bound.unsafe('SELECT * FROM '+table(name)+' ORDER BY id');
     state.sourceRevisions=await bound.unsafe('SELECT id,revision FROM '+table('assessment_scopes')+' ORDER BY id');
     return state;
    };
    const failWithoutWrites=async (relations,execute)=>{
     const before=await restrictedState();
     for(const name of relations) {
      await bound.unsafe('SELECT pg_catalog.set_config($1,$2,true)',[failureSetting,name]);
      try {
       assert.deepEqual(await execute(),{ok:false,code:'transaction_failed'});
       assert.deepEqual(await restrictedState(),before);
       assert.equal((await bound.unsafe('SELECT current_user AS name'))[0].name,security.roles.writer);
      } finally { await bound.unsafe('SELECT pg_catalog.set_config($1,$2,true)',[failureSetting,'']); }
     }
    };
    const failureCreate=createCommand(failurePupil,'restricted-failure-create');
    const createRestricted=()=>executeFixtureReportWorkflow(restrictedDb,schema,failureCreate,verifyIdentity);
    await failWithoutWrites(['report_cards','report_card_audit','report_card_operation_receipts'],createRestricted);
    const retryCreated=await createRestricted();assert.equal(retryCreated.ok,true,JSON.stringify(retryCreated));assert.equal(retryCreated.kind,'applied');
    const createReplay=await createRestricted();assert.equal(createReplay.kind,'replay');assert.equal(createReplay.reportId,retryCreated.reportId);
    const failureSubmit={action:'submit',reportId:retryCreated.reportId,expectedVersion:1,operationKey:'restricted-failure-submit'};
    const submitRestricted=()=>executeFixtureReportWorkflow(restrictedDb,schema,failureSubmit,verifyIdentity);
    await failWithoutWrites(['report_card_audit','report_card_operation_receipts'],submitRestricted);
    assert.equal((await submitRestricted()).kind,'applied');assert.equal((await submitRestricted()).kind,'replay');
    console.log('PASS: restricted creation and submission failures roll back every report/audit/receipt write and same keys retry then replay');

    const failureApprove={action:'approve',reportId:retryCreated.reportId,expectedVersion:2,operationKey:'restricted-failure-approve'};
    const approveRestricted=()=>executeFixtureCanonicalReportCommand(restrictedDb,schema,failureApprove,verifyAdmin);
    await failWithoutWrites(['report_card_snapshots','report_card_audit','report_card_operation_receipts'],approveRestricted);
    const retryApproved=await approveRestricted();assert.equal(retryApproved.kind,'applied');
    const approvalReplay=await approveRestricted();assert.equal(approvalReplay.kind,'replay');assert.equal(approvalReplay.snapshotId,retryApproved.snapshotId);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_snapshots')+' WHERE report_id=$1::uuid',[retryCreated.reportId])).length,1);
    console.log('PASS: restricted approval rolls back snapshot/report/audit/receipt failures and retries with exactly one immutable snapshot');

    const failurePublish={action:'publish',reportId:retryCreated.reportId,expectedVersion:3,operationKey:'restricted-failure-publish'};
    const publishRestricted=()=>executeFixtureCanonicalReportCommand(restrictedDb,schema,failurePublish,verifyAdmin);
    await failWithoutWrites(['report_card_releases','report_card_audit','report_card_operation_receipts'],publishRestricted);
    const retryPublished=await publishRestricted();assert.equal(retryPublished.kind,'applied');assert.equal(retryPublished.snapshotId,retryApproved.snapshotId);
    assert.equal((await publishRestricted()).kind,'replay');
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid',[retryCreated.reportId])).length,1);
    console.log('PASS: restricted publication release/audit/receipt failures preserve approval and same-key retry publishes the original snapshot once');
    const firstRelease=(await bound.unsafe('SELECT id,snapshot_id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryCreated.reportId]))[0];
    const firstApprovedSnapshot=await bound.unsafe('SELECT * FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[firstRelease.snapshot_id]);
    const revokeCommand={action:'revoke',reportId:retryCreated.reportId,releaseId:firstRelease.id,expectedVersion:4,operationKey:'restricted-revoke',reason:'Correct the subject score'};
    const revokeRestricted=()=>executeFixtureReportRevocation(restrictedDb,schema,revokeCommand,verifyAdmin);
    assert.deepEqual(await executeFixtureReportRevocation(restrictedDb,schema,revokeCommand,verifyIdentity),{ok:false,code:'forbidden'});
    await failWithoutWrites(['report_card_releases','report_cards','report_card_audit','report_card_operation_receipts'],revokeRestricted);
    const revoked=await revokeRestricted();assert.equal(revoked.ok,true,JSON.stringify(revoked));assert.equal(revoked.kind,'applied');assert.equal(revoked.version,5);
    assert.equal((await revokeRestricted()).kind,'replay');
    assert.deepEqual(await executeFixtureReportRevocation(restrictedDb,schema,{...revokeCommand,reason:'changed reason'},verifyAdmin),{ok:false,code:'idempotency_conflict'});
    await expectError('23514',()=>tx.savepoint(inner=>wrap(inner).unsafe('UPDATE '+table('report_card_releases')+' SET revoked_at=NULL WHERE id=$1::uuid',[firstRelease.id])));
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryCreated.reportId])).length,0);
    console.log('PASS: actual restricted revoke writer rolls back release/report/audit/receipt failures, retries and replays without restoration privileges');

    assert.equal((await executeFixtureReportWorkflow(restrictedDb,schema,{action:'submit',reportId:retryCreated.reportId,expectedVersion:5,operationKey:'restricted-correct-submit'},verifyIdentity)).ok,true);
    assert.equal((await executeFixtureCanonicalReportCommand(restrictedDb,schema,{action:'approve',reportId:retryCreated.reportId,expectedVersion:6,operationKey:'restricted-correct-approve'},verifyAdmin)).ok,true);
    const correctedPublication=await executeFixtureCanonicalReportCommand(restrictedDb,schema,{action:'publish',reportId:retryCreated.reportId,expectedVersion:7,operationKey:'restricted-correct-publish'},verifyAdmin);
    assert.equal(correctedPublication.ok,true,JSON.stringify(correctedPublication));assert.notEqual(correctedPublication.snapshotId,firstRelease.snapshot_id);
    assert.deepEqual(await bound.unsafe('SELECT * FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[firstRelease.snapshot_id]),firstApprovedSnapshot);
    assert.equal((await revokeRestricted()).kind,'replay');
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryCreated.reportId])).length,1);
    console.log('PASS: restricted correction resubmits, independently approves and republishes a new snapshot while original release and replay remain historical');

    const secondRelease=(await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryCreated.reportId]))[0];
    const secondRevoke=await executeFixtureReportRevocation(restrictedDb,schema,{...revokeCommand,releaseId:secondRelease.id,expectedVersion:8,operationKey:'restricted-revoke-second',reason:'Second correction'},verifyAdmin);
    assert.equal(secondRevoke.ok,true,JSON.stringify(secondRevoke));assert.equal(secondRevoke.version,9);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_audit')+" WHERE report_id=$1::uuid AND action='revoke'",[retryCreated.reportId])).length,2);
    assert.equal((await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryCreated.reportId])).length,0);
    console.log('PASS: repeated restricted corrections retain distinct revoke events and snapshots without resurrecting an earlier publication');
    throw rollbackSecurity;
   }),error=>error===rollbackSecurity);
   assert.equal((await sql.unsafe(rolePreflight.query,rolePreflight.parameters)).length,0);
   const flags=await sql.unsafe('SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid=$1::pg_catalog.regclass',[table('report_cards')]);
   assert.equal(flags[0].relrowsecurity,false);
   assert.equal((await sql.unsafe('SELECT id FROM '+table('report_cards')+' WHERE student_id IN ($1::uuid,$2::uuid)',[securityPupil.studentId,failurePupil.studentId])).length,0);
   console.log('PASS: temporary security roles, grants, policies and workload writes roll back together without persistent role changes');
  } else console.log('SKIPPED: ten restricted-role groups require REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM=DISPOSABLE_ROLE_ADMIN_TEST_ONLY and a local role-admin test connection; 43 owner-run groups do not prove restricted access');

  const revocationTime='2026-10-19T12:00:00.000Z';
  const revokeAudit={...reportAuditRow,id:randomUUID(),action:'revoke',before_stage:'published',after_stage:'draft',before_version:4,after_version:5,
   release_id:reportReleaseRow.id,reason:'Correct the published score',occurred_at:revocationTime};
  const otherPublication=(await sql.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid',[firstWriter.reportId]))[0];
  await expectError('23503',()=>insert(sql,'report_card_audit',{...revokeAudit,id:randomUUID(),release_id:randomUUID()}));
  await expectError('23503',()=>insert(sql,'report_card_audit',{...revokeAudit,id:randomUUID(),release_id:otherPublication.id}));
  await expectError('23503',()=>insert(sql,'report_card_audit',{...revokeAudit,id:randomUUID(),snapshot_id:snapshotB}));
  for(const patch of [{release_id:null},{reason:null},{reason:' '},{reason:'x'.repeat(2001)},{before_stage:'approved'},{snapshot_report_version:2},{before_version:5,after_version:6}])
   await expectError('23514',()=>insert(sql,'report_card_audit',{...revokeAudit,id:randomUUID(),...patch}));
  await expectError('23505',()=>client.begin(async tx=>{
   const bound=wrap(tx);await insert(bound,'report_card_audit',revokeAudit);
   await insert(bound,'report_card_audit',{...revokeAudit,id:randomUUID()});
  }));
  console.log('PASS: revoke audit binds the exact historical release/snapshot/version, requires a reason and permits one event per release');

  for(const statement of reportReleaseGuardDDL(schema).statements)await sql.unsafe(statement);
  const originalRelease=(await sql.unsafe('SELECT * FROM '+table('report_card_releases')+' WHERE id=$1::uuid',[reportReleaseRow.id]))[0];
  const historyRollback=Error('intentional release history rollback');
  for(const statement of [
   'UPDATE '+table('report_card_releases')+' SET published_by=$2::uuid WHERE id=$1::uuid',
   'UPDATE '+table('report_card_releases')+' SET snapshot_id=$2::uuid WHERE id=$1::uuid',
   'UPDATE '+table('report_card_releases')+' SET id=$2::uuid WHERE id=$1::uuid',
  ])await expectError('23514',()=>sql.unsafe(statement,[reportReleaseRow.id,randomUUID()]));
  await expectError('23514',()=>insert(sql,'report_card_releases',{...reportReleaseRow,id:randomUUID(),revoked_at:revocationTime}));
  await assert.rejects(client.begin(async tx=>{
   const bound=wrap(tx);
   await bound.unsafe('UPDATE '+table('report_card_releases')+' SET revoked_at=$2::timestamptz WHERE id=$1::uuid',[reportReleaseRow.id,revocationTime]);
   for(const value of [null,revocationTime,'2026-10-19T13:00:00.000Z'])
    await expectError('23514',()=>tx.savepoint(inner=>wrap(inner).unsafe('UPDATE '+table('report_card_releases')+' SET revoked_at=$2::timestamptz WHERE id=$1::uuid',[reportReleaseRow.id,value])));
   throw historyRollback;
  }),error=>error===historyRollback);
  assert.deepEqual((await sql.unsafe('SELECT * FROM '+table('report_card_releases')+' WHERE id=$1::uuid',[reportReleaseRow.id]))[0],originalRelease);
  await expectError('P0001',()=>sql.unsafe('DELETE FROM '+table('report_card_releases')+' WHERE false'));
  await expectError('P0001',()=>sql.unsafe('TRUNCATE '+table('report_card_releases')+' CASCADE'));
  console.log('PASS: release history freezes original facts, permits one revocation, rejects restoration/deletion/truncate and rolls back cleanly');

  const beforeCorrectionReport=await sql.unsafe('SELECT * FROM '+table('report_cards')+' WHERE id=$1::uuid',[reportA]);
  const beforeCorrectionSnapshot=await sql.unsafe('SELECT * FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[snapshotA]);
  const revokeBindingFixture=operationKey=>client.begin(async tx=>{
   const bound=wrap(tx);
   await bound.unsafe('SELECT id FROM '+table('report_cards')+' WHERE id=$1::uuid FOR UPDATE',[reportA]);
   await bound.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE id=$1::uuid FOR UPDATE',[reportReleaseRow.id]);
   await bound.unsafe('UPDATE '+table('report_card_releases')+' SET revoked_at=$2::timestamptz WHERE id=$1::uuid',[reportReleaseRow.id,revocationTime]);
   const changed=await bound.unsafe('UPDATE '+table('report_cards')+" SET stage='draft',version=5,submitted_by=NULL,approved_by=NULL,published_at=NULL,return_reason=NULL WHERE id=$1::uuid AND version=4 AND stage='published' RETURNING id",[reportA]);
   assert.equal(changed.length,1);
   await insert(bound,'report_card_audit',{...revokeAudit,id:randomUUID()});
   await insert(bound,'report_card_operation_receipts',{...reportReceiptRow,report_id:reportA,operation_key:operationKey,resulting_version:5,outcome:{ok:true,action:'revoke',releaseId:reportReleaseRow.id,snapshotId:snapshotA,version:5}});
  });
  await expectError('23505',()=>revokeBindingFixture('reserved-report-key'));
  assert.deepEqual(await sql.unsafe('SELECT * FROM '+table('report_cards')+' WHERE id=$1::uuid',[reportA]),beforeCorrectionReport);
  assert.deepEqual((await sql.unsafe('SELECT * FROM '+table('report_card_releases')+' WHERE id=$1::uuid',[reportReleaseRow.id]))[0],originalRelease);
  assert.equal((await sql.unsafe('SELECT id FROM '+table('report_card_audit')+" WHERE release_id=$1::uuid AND action='revoke'",[reportReleaseRow.id])).length,0);
  await revokeBindingFixture('revoke-binding-fixture');
  const corrected=(await sql.unsafe('SELECT stage,version,submitted_by,approved_by,published_at FROM '+table('report_cards')+' WHERE id=$1::uuid',[reportA]))[0];
  assert.equal(corrected.stage,'draft');assert.equal(corrected.version,5);assert.equal(corrected.submitted_by,null);assert.equal(corrected.approved_by,null);assert.equal(corrected.published_at,null);
  assert.deepEqual(await sql.unsafe('SELECT * FROM '+table('report_card_snapshots')+' WHERE id=$1::uuid',[snapshotA]),beforeCorrectionSnapshot);
  assert.equal((await sql.unsafe('SELECT reason FROM '+table('report_card_audit')+' WHERE release_id=$1::uuid',[reportReleaseRow.id]))[0].reason,revokeAudit.reason);
  assert.equal((await sql.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[reportA])).length,0);
  console.log('PASS: fixture withdrawal report/release/audit/receipt changes roll back on collision, retry atomically and preserve the original snapshot');

  const concurrentRelease=(await sql.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[guardCreated.reportId]))[0];
  const concurrentRevoke={action:'revoke',reportId:guardCreated.reportId,releaseId:concurrentRelease.id,expectedVersion:4,operationKey:'actual-concurrent-revoke',reason:'Correct publication'};
  const runActualRevoke=(command,auth=adminAuth)=>executeFixtureReportRevocation(writerDb,schema,command,async()=>({authUserId:auth}));
  const concurrentRevocations=await Promise.all([runActualRevoke(concurrentRevoke),runActualRevoke(concurrentRevoke)]);
  assert.equal(concurrentRevocations.every(r=>r.ok),true,JSON.stringify(concurrentRevocations));
  assert.deepEqual(concurrentRevocations.map(r=>r.kind).sort(),['applied','replay']);
  assert.deepEqual(await runActualRevoke({...concurrentRevoke,reason:'changed intent'}),{ok:false,code:'idempotency_conflict'});
  assert.equal((await runWriter({reportId:guardCreated.reportId,action:'publish',expectedVersion:3,operationKey:'workflow-guard-publish'})).kind,'replay');
  console.log('PASS: actual revoke writer serializes concurrent same-key withdrawal and preserves historical publish replay after source changes');

  const retryRevokeRelease=(await sql.unsafe('SELECT id FROM '+table('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[retryPublication.reportId]))[0];
  const retryRevokeCommand={action:'revoke',reportId:retryPublication.reportId,releaseId:retryRevokeRelease.id,expectedVersion:4,operationKey:'actual-revoke-failure-retry',reason:'Withdraw stale publication'};
  await sql.unsafe(`CREATE FUNCTION ${table('fixture_actual_revoke_failure')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_setting('${schema}.revoke_fail_relation',true)=TG_TABLE_NAME THEN RAISE EXCEPTION 'injected actual revoke failure'; END IF;
 RETURN NEW;
END $$`);
  for(const name of ['report_cards','report_card_releases','report_card_audit','report_card_operation_receipts'])await sql.unsafe('CREATE TRIGGER fixture_actual_revoke_failure BEFORE INSERT OR UPDATE ON '+table(name)+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_actual_revoke_failure')+'()');
  const beforeActualRevoke=async()=>{
   const state={};for(const name of ['report_cards','report_card_releases','report_card_snapshots','report_card_audit','report_card_operation_receipts'])state[name]=await sql.unsafe('SELECT * FROM '+table(name)+' ORDER BY id');return state;
  };
  const beforeRevokeFailure=await beforeActualRevoke();
  for(const name of ['report_card_releases','report_cards','report_card_audit','report_card_operation_receipts']){
   const failDb={...sql,begin:callback=>client.begin(async tx=>{const bound=wrap(tx);await bound.unsafe('SELECT pg_catalog.set_config($1,$2,true)',[schema+'.revoke_fail_relation',name]);return callback(bound);})};
   assert.deepEqual(await executeFixtureReportRevocation(failDb,schema,retryRevokeCommand,async()=>({authUserId:adminAuth})),{ok:false,code:'transaction_failed'});
   assert.deepEqual(await beforeActualRevoke(),beforeRevokeFailure);
  }
  assert.deepEqual(await runActualRevoke(retryRevokeCommand,authUser),{ok:false,code:'forbidden'});
  assert.equal((await runActualRevoke(retryRevokeCommand)).kind,'applied');assert.equal((await runActualRevoke(retryRevokeCommand)).kind,'replay');
  console.log('PASS: actual outer revoke transaction rolls back every injected persistence failure and withdraws stale-source publication on same-key retry');

  if(testRestrictedRoles) {
   // A separate committed fixture is required: another backend cannot see the
   // uncommitted roles/policies from the savepoint security tests above.
   const sessionSchema='rc_it_'+randomBytes(8).toString('hex');
   const sessionFixture=assessmentFixtureDDL(sessionSchema,{includeReports:true});
   const sessionSecurity=fixtureSecurityPlan(sessionSchema,ids.school);
   const completePlan=completeFixtureAuthorityDDL(sessionSchema,await readFile(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql',import.meta.url),'utf8'));
   const completeHolders=[],completeReleases=[];
   const sessionTable=sessionFixture.table,runToken=randomBytes(24).toString('hex');
   const loginPlan=disposableLoginPlan(sessionSchema),loginPassword=randomBytes(32).toString('hex');
   const databaseName=decodeURIComponent(parsed.pathname.slice(1));
   let sessionCommitted=false,loginClient=null,assignmentReplay=null,releaseAssignmentReplay=null;
   const cleanupProbe=Error('intentional independent-session cleanup probe');
   await assert.rejects((async()=>{
   try {
    await client.begin(async tx=>{
     const bound=wrap(tx);await bound.unsafe(guards.readGate);
     for(const statement of sessionFixture.statements)await bound.unsafe(statement);
     await bound.unsafe('CREATE TABLE '+sessionTable('fixture_run_marker')+' (token text PRIMARY KEY)');
     await bound.unsafe('INSERT INTO '+sessionTable('fixture_run_marker')+' VALUES ($1::text)',[runToken]);
     // Respect the new audit -> release FK. Enum types belong to their schema,
     // so clone them through text while copying all other values losslessly.
     const copyOrder=[...fixtureTables,...[reportFixtureTables[0],reportFixtureTables[1],reportFixtureTables[4],reportFixtureTables[2],reportFixtureTables[3]]];
     for(const model of copyOrder){
      const metadata=getTableConfig(model),columns=metadata.columns.map(c=>q(c.name));
      const values=metadata.columns.map(c=>{const type=sessionFixture.columnType(c),value='s.'+q(c.name);return type.startsWith(q(sessionSchema)+'.')?value+'::text::'+type:value;});
      await bound.unsafe('INSERT INTO '+sessionTable(metadata.name)+' ('+columns.join(',')+') SELECT '+values.join(',')+' FROM '+table(metadata.name)+' s');
     }
     for(const statement of assessmentWriteGuardDDL(sessionSchema).statements)await bound.unsafe(statement);
     for(const statement of assessmentAuthorityGuardDDL(sessionSchema).statements)await bound.unsafe(statement);
     await bound.unsafe(`CREATE FUNCTION ${sessionTable('fixture_append_only')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'independent fixture history is append-only' USING ERRCODE='P0001'; RETURN NULL; END $$`);
     for(const name of ['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts','report_card_snapshots','report_card_audit','report_card_operation_receipts']){
      await bound.unsafe('CREATE TRIGGER fixture_append_only BEFORE UPDATE OR DELETE ON '+sessionTable(name)+' FOR EACH STATEMENT EXECUTE FUNCTION '+sessionTable('fixture_append_only')+'()');
      await bound.unsafe('CREATE TRIGGER fixture_no_truncate BEFORE TRUNCATE ON '+sessionTable(name)+' FOR EACH STATEMENT EXECUTE FUNCTION '+sessionTable('fixture_append_only')+'()');
     }
     for(const role of Object.values(sessionSecurity.roles))await bound.unsafe('CREATE ROLE '+q(role)+' NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION');
     await bound.unsafe('GRANT '+Object.values(sessionSecurity.roles).map(q).join(',')+' TO CURRENT_USER WITH SET TRUE');
     const preflight=fixtureRolePreflightPlan(sessionSchema);
     assert.equal(inspectFixtureRestrictedRoles(sessionSchema,await bound.unsafe(preflight.query,preflight.parameters)).ok,true);
     for(const statement of sessionSecurity.statements)await bound.unsafe(statement);
     for(const statement of completePlan.statements)await bound.unsafe(statement);
     // Secret is generated in memory and never printed or saved. Hex validation
     // precedes interpolation because CREATE ROLE PASSWORD cannot bind a value.
     disposableLoginURL(url,sessionSchema,loginPassword);
     try {
      await bound.unsafe('CREATE ROLE '+q(loginPlan.login)+" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD '"+loginPassword+"'");
     } catch { throw Error('Disposable login provisioning failed (details suppressed to protect generated secret)'); }
     for(const option of ['SET TRUE','INHERIT FALSE','ADMIN FALSE'])await bound.unsafe('GRANT '+loginPlan.roles.map(q).join(',')+' TO '+q(loginPlan.login)+' WITH '+option);
     await bound.unsafe('GRANT CONNECT ON DATABASE '+q(databaseName)+' TO '+q(loginPlan.login));
     assert.equal(inspectDisposableLogin(sessionSchema,await bound.unsafe(loginPlan.query,loginPlan.parameters)),true);

    });
    sessionCommitted=true;
    loginClient=postgres(disposableLoginURL(url,sessionSchema,loginPassword),{max:4,prepare:false,connect_timeout:5,onnotice:()=>{}});
    const loginWrap=tx=>({unsafe:(query,parameters=[])=>tx.unsafe(query,parameters.map(v=>typeof v==='string'?loginClient.typed(v,25):v))});
    try {
     const evidence=(await loginClient.unsafe('SELECT session_user AS login,current_user AS role'))[0];
     assert.equal(evidence.login,loginPlan.login);assert.equal(evidence.role,loginPlan.login);
    } catch { throw Error('Disposable login authentication/evidence failed (connection details suppressed)'); }
    await expectError('42501',()=>loginClient.unsafe('SELECT id FROM '+sessionTable('report_cards')));
    const ownerName=(await sql.unsafe('SELECT current_user AS name'))[0].name;
    await expectError('42501',()=>loginClient.begin(tx=>tx.unsafe('SET LOCAL ROLE '+q(ownerName))));
    await expectError('42501',()=>loginClient.begin(tx=>tx.unsafe('CREATE ROLE '+q(sessionSchema+'_forbidden'))));
    await expectError('42501',()=>loginClient.begin(tx=>tx.unsafe('GRANT '+q(sessionSecurity.roles.writer)+' TO '+q(ownerName))));
    console.log('PASS: actual generated login has no inherited fixture access, administrator role switch, role creation or membership administration');
    const roleDb=(role,rendezvous=null,seen=null)=>({
     unsafe:()=>{throw Error('Restricted SQL requires its transaction');},
     begin:callback=>loginClient.begin(async tx=>{
      const bound=loginWrap(tx);await bound.unsafe('SET LOCAL ROLE '+q(role));
      await bound.unsafe("SET LOCAL row_security=on");await bound.unsafe("SET LOCAL lock_timeout='5s'");await bound.unsafe("SET LOCAL statement_timeout='15s'");
      const evidence=(await bound.unsafe("SELECT session_user AS login,current_user AS role,pg_catalog.pg_backend_pid() AS pid,pg_catalog.current_setting('row_security') AS security"))[0];
      assert.equal(evidence.login,loginPlan.login);assert.equal(evidence.role,role);assert.equal(evidence.security,'on');if(seen)seen.add(evidence.pid);
      if(rendezvous)await rendezvous.arrive(evidence.pid,evidence.role);
      return callback(bound);
     }),
    });
    const sessionPair=async execute=>{
     const rendezvous=disposableSessionRendezvous(sessionSecurity.roles.writer),seen=new Set();
     const pending=[0,1].map(index=>execute(roleDb(sessionSecurity.roles.writer,rendezvous,seen),index).catch(error=>{rendezvous.cancel();throw error;}));
     const results=await Promise.allSettled(pending);rendezvous.cancel();
     for(const result of results)if(result.status==='rejected')throw result.reason;
     assert.equal(seen.size,2,'workload must run in two distinct restricted PostgreSQL backends');
     return results.map(result=>result.value);
    };
    const assertSingleApply=results=>{assert.equal(results.every(result=>result.ok),true,JSON.stringify(results));assert.deepEqual(results.map(result=>result.kind).sort(),['applied','replay']);};
    const teacherIdentity=async()=>({authUserId:authUser}),adminIdentity=async()=>({authUserId:adminAuth});
    const independentSubmit={action:'submit',reportId:reportA,expectedVersion:5,operationKey:'independent-submit'};
    assertSingleApply(await sessionPair(db=>executeFixtureReportWorkflow(db,sessionSchema,independentSubmit,teacherIdentity)));
    assert.equal((await sql.unsafe('SELECT version FROM '+sessionTable('report_cards')+' WHERE id=$1::uuid',[reportA]))[0].version,6);
    console.log('PASS: two distinct restricted PostgreSQL sessions serialize same-key submission and replay under committed fixture RLS');

    assertSingleApply(await sessionPair(db=>executeFixtureCanonicalReportCommand(db,sessionSchema,{action:'approve',reportId:reportA,expectedVersion:6,operationKey:'independent-approve'},adminIdentity)));
    assertSingleApply(await sessionPair(db=>executeFixtureCanonicalReportCommand(db,sessionSchema,{action:'publish',reportId:reportA,expectedVersion:7,operationKey:'independent-publish'},adminIdentity)));
    const independentRelease=(await sql.unsafe('SELECT id FROM '+sessionTable('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[reportA]))[0];
    const independentRevoke={action:'revoke',reportId:reportA,releaseId:independentRelease.id,expectedVersion:8,operationKey:'independent-revoke',reason:'Correct publication across sessions'};
    assertSingleApply(await sessionPair(db=>executeFixtureReportRevocation(db,sessionSchema,independentRevoke,adminIdentity)));
    assert.equal((await sql.unsafe('SELECT id FROM '+sessionTable('report_card_snapshots')+' WHERE report_id=$1::uuid',[reportA])).length,2);
    assert.equal((await sql.unsafe('SELECT id FROM '+sessionTable('report_card_releases')+' WHERE report_id=$1::uuid AND revoked_at IS NULL',[reportA])).length,0);
    console.log('PASS: independent restricted approval/publication/revocation pairs apply once, replay once and preserve immutable snapshot/release history');

    const competing=await sessionPair((db,index)=>executeFixtureReportWorkflow(db,sessionSchema,{action:'submit',reportId:reportA,expectedVersion:9,operationKey:'independent-competing-'+index},teacherIdentity));
    assert.equal(competing.filter(result=>result.ok&&result.kind==='applied').length,1,JSON.stringify(competing));
    assert.equal(competing.filter(result=>!result.ok&&result.code==='stale_version').length,1,JSON.stringify(competing));
    const reader=roleDb(sessionSecurity.roles.reader),writer=roleDb(sessionSecurity.roles.writer);
    await reader.begin(async bound=>{assert.equal((await bound.unsafe('SELECT id FROM '+sessionTable('schools')+' WHERE id=$1::uuid',[ids.foreignSchool])).length,0);});
    await expectError('42501',()=>reader.begin(bound=>bound.unsafe('UPDATE '+sessionTable('report_cards')+" SET stage='draft' WHERE false")));
    assert.deepEqual(await executeFixtureCanonicalReportCommand(writer,sessionSchema,{action:'approve',reportId:reportA,expectedVersion:10,operationKey:'independent-teacher-denial'},teacherIdentity),{ok:false,code:'forbidden'});
    assert.equal((await executeFixtureReportRevocation(writer,sessionSchema,independentRevoke,adminIdentity)).kind,'replay');
    console.log('PASS: distinct restricted sessions reject competing stale keys, foreign-school reads, reader writes and teacher approval while historical replay survives');

    // A historical receipt never substitutes for current class/session access.
    // Keep an actual restricted replay open after its assignment SELECT locks,
    // then demonstrate that a separate authority writer cannot interleave.
    const historyTables=['report_cards','report_card_snapshots','report_card_releases','report_card_audit','report_card_operation_receipts'];
    const reportHistory=async()=>Promise.all(historyTables.map(name=>sql.unsafe('SELECT to_jsonb(r) AS payload FROM '+sessionTable(name)+' r WHERE '+(name==='report_cards'?'id':'report_id')+'=$1::uuid ORDER BY to_jsonb(r)::text',[reportA])));
    const historyBefore=await reportHistory();
    const activeAssignments=await sql.unsafe('SELECT a.id FROM '+sessionTable('teacher_class_assignments')+' a JOIN '+sessionTable('report_cards')+' r ON r.school_id=a.school_id AND r.class_id=a.class_id AND r.session_id=a.session_id WHERE r.id=$1::uuid AND a.teacher_membership_id=$2::uuid AND a.ended_at IS NULL',[reportA,ids.teacher]);
    assert.equal(activeAssignments.length,1);
    let signalAssignment;
    const assignmentReady=new Promise(resolve=>{signalAssignment=resolve;});
    const assignmentGate=new Promise(resolve=>{releaseAssignmentReplay=resolve;});
    const heldReplayDb={
     unsafe:()=>{throw Error('Replay requires its restricted transaction');},
     begin:callback=>writer.begin(bound=>callback({unsafe:async(query,parameters=[])=>{
      const result=await bound.unsafe(query,parameters);
      if(query.includes('FROM '+sessionTable('teacher_class_assignments'))&&query.endsWith('FOR SHARE')){signalAssignment();await assignmentGate;}
      return result;
     }})),
    };
    assignmentReplay=executeFixtureReportWorkflow(heldReplayDb,sessionSchema,independentSubmit,teacherIdentity);
    try {
     await awaitFixtureAuthorityLock(assignmentReplay,assignmentReady);
     await expectError('55P03',()=>client.begin(async tx=>{
      const bound=wrap(tx);await bound.unsafe("SET LOCAL lock_timeout='200ms'");
      await bound.unsafe('UPDATE '+sessionTable('teacher_class_assignments')+' SET ended_at=now() WHERE id=$1::uuid',[activeAssignments[0].id]);
     }));
    }finally{releaseAssignmentReplay();}
    assert.equal((await assignmentReplay).kind,'replay');
    await sql.unsafe('UPDATE '+sessionTable('teacher_class_assignments')+' SET ended_at=now() WHERE id=$1::uuid',[activeAssignments[0].id]);
    assert.deepEqual(await executeFixtureReportWorkflow(writer,sessionSchema,independentSubmit,teacherIdentity),{ok:false,code:'forbidden'});
    assert.deepEqual(await executeFixtureReportWorkflow(writer,sessionSchema,{action:'submit',reportId:reportA,expectedVersion:10,operationKey:'assignment-ended-new-key'},teacherIdentity),{ok:false,code:'forbidden'});
    assert.deepEqual(await reportHistory(),historyBefore);
    await sql.unsafe('UPDATE '+sessionTable('teacher_class_assignments')+' SET ended_at=NULL WHERE id=$1::uuid',[activeAssignments[0].id]);
    assert.equal((await executeFixtureReportWorkflow(writer,sessionSchema,independentSubmit,teacherIdentity)).kind,'replay');
    assert.deepEqual(await reportHistory(),historyBefore);
    console.log('PASS: restricted in-flight replay blocks assignment removal; ended assignment denies old and new keys without changing report history');

    const adminReplays=[{action:'approve',reportId:reportA,expectedVersion:6,operationKey:'independent-approve'},{action:'publish',reportId:reportA,expectedVersion:7,operationKey:'independent-publish'}];
    await sql.unsafe("UPDATE "+sessionTable('memberships')+" SET status='suspended' WHERE id=$1::uuid",[ids.teacher]);
    assert.deepEqual(await executeFixtureReportWorkflow(writer,sessionSchema,independentSubmit,teacherIdentity),{ok:false,code:'forbidden'});
    assert.deepEqual(await reportHistory(),historyBefore);
    await sql.unsafe("UPDATE "+sessionTable('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.teacher]);
    assert.equal((await executeFixtureReportWorkflow(writer,sessionSchema,independentSubmit,teacherIdentity)).kind,'replay');
    await sql.unsafe("UPDATE "+sessionTable('memberships')+" SET status='suspended' WHERE id=$1::uuid",[ids.admin]);
    for(const command of adminReplays)assert.deepEqual(await executeFixtureCanonicalReportCommand(writer,sessionSchema,command,adminIdentity),{ok:false,code:'forbidden'});
    assert.deepEqual(await executeFixtureReportRevocation(writer,sessionSchema,independentRevoke,adminIdentity),{ok:false,code:'forbidden'});
    assert.deepEqual(await reportHistory(),historyBefore);
    await sql.unsafe("UPDATE "+sessionTable('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.admin]);
    for(const command of adminReplays)assert.equal((await executeFixtureCanonicalReportCommand(writer,sessionSchema,command,adminIdentity)).kind,'replay');
    assert.equal((await executeFixtureReportRevocation(writer,sessionSchema,independentRevoke,adminIdentity)).kind,'replay');
    assert.deepEqual(await reportHistory(),historyBefore);
    console.log('PASS: suspended teacher/admin cannot replay submission, approval, publication or revocation; reactivation replays history without new writes');

    // Combine the complete authority helper and real fixture writers in ONE
    // restricted transaction. The helper itself also enforces source-before-
    // authority ordering, so direct private helper entry cannot invert gates.
    const teacherBinding={authUserId:authUser,schoolUserId:ids.teacherUser,membershipId:ids.teacher,schoolId:ids.school};
    const adminBinding={authUserId:adminAuth,schoolUserId:ids.adminUser,membershipId:ids.admin,schoolId:ids.school};
    const completeTeacher=work=>executeCompleteFixtureReport(writer,sessionSchema,teacherBinding,work);
    const completeAdmin=work=>executeCompleteFixtureReport(writer,sessionSchema,adminBinding,work);
    assert.equal((await completeTeacher((db,identity)=>executeFixtureReportWorkflow(db,sessionSchema,independentSubmit,identity))).kind,'replay');
    for(const command of adminReplays)assert.equal((await completeAdmin((db,identity)=>executeFixtureCanonicalReportCommand(db,sessionSchema,command,identity))).kind,'replay');
    assert.equal((await completeAdmin((db,identity)=>executeFixtureReportRevocation(db,sessionSchema,independentRevoke,identity))).kind,'replay');
    await expectError('42501',()=>reader.begin(bound=>bound.unsafe('SELECT * FROM '+sessionTable('lock_report_card_actor')+'($1::uuid)',[authUser])));
    await expectError('42501',()=>loginClient.begin(tx=>tx.unsafe('SET LOCAL ROLE '+q(completePlan.owner))));
    assert.deepEqual(await executeCompleteFixtureReport(writerDb,sessionSchema,teacherBinding,async()=>({ok:true})),{ok:false,code:'forbidden'});
    const hiddenMembership=randomUUID();
    await sql.unsafe('INSERT INTO '+sessionTable('memberships')+" (id,school_id,user_id,role,status) VALUES ($1::uuid,$2::uuid,$3::uuid,'teacher','active')",[hiddenMembership,ids.foreignSchool,ids.teacherUser]);
    await writer.begin(async bound=>{assert.equal((await bound.unsafe('SELECT id FROM '+sessionTable('memberships')+" WHERE user_id=$1::uuid AND status='active'",[ids.teacherUser])).length,1);});
    let hiddenWork=false;
    assert.deepEqual(await completeTeacher(async()=>{hiddenWork=true;return {ok:true};}),{ok:false,code:'forbidden'});
    assert.equal(hiddenWork,false);assert.deepEqual(await reportHistory(),historyBefore);
    await sql.unsafe('DELETE FROM '+sessionTable('memberships')+' WHERE id=$1::uuid',[hiddenMembership]);
    assert.equal((await completeTeacher((db,identity)=>executeFixtureReportWorkflow(db,sessionSchema,independentSubmit,identity))).kind,'replay');
    console.log('PASS: complete authority and real restricted writers share one transaction; hidden second membership, reader helper access and owner fallback are denied');

    const completeReturn={action:'return',reportId:reportA,expectedVersion:10,operationKey:'complete-boundary-return',reason:'Complete authority transaction rollback check'};
    const rejectedBoundary=await completeAdmin(async(db,identity)=>{
     const applied=await executeFixtureReportWorkflow(db,sessionSchema,completeReturn,identity);
     assert.equal(applied.ok,true,JSON.stringify(applied));
     return {ok:false,code:'injected_outer_failure'};
    });
    assert.deepEqual(rejectedBoundary,{ok:false,code:'injected_outer_failure'});
    assert.deepEqual(await reportHistory(),historyBefore);
    const completeReturned=await completeAdmin((db,identity)=>executeFixtureReportWorkflow(db,sessionSchema,completeReturn,identity));
    assert.equal(completeReturned.ok,true,JSON.stringify(completeReturned));assert.equal(completeReturned.kind,'applied');assert.equal(completeReturned.version,11);
    const afterCompleteReturn=await reportHistory();
    assert.equal((await completeAdmin((db,identity)=>executeFixtureReportWorkflow(db,sessionSchema,completeReturn,identity))).kind,'replay');
    assert.deepEqual(await reportHistory(),afterCompleteReturn);
    console.log('PASS: complete outer boundary rolls back successful inner writer on rejected outcome; same-key retry applies once and replay adds no writes');

    let signalComplete,releaseComplete;
    const completeReady=new Promise(resolve=>{signalComplete=resolve;});
    const completeGate=new Promise(resolve=>{releaseComplete=resolve;});completeReleases.push(releaseComplete);
    const heldComplete=completeAdmin(async(db,identity)=>{
     const replay=await executeFixtureReportWorkflow(db,sessionSchema,completeReturn,identity);
     assert.equal(replay.kind,'replay');signalComplete();await completeGate;return replay;
    });completeHolders.push(heldComplete);
    await awaitFixtureAuthorityLock(heldComplete,completeReady);
    for(const [query,parameters] of [
     ['UPDATE '+sessionTable('assessment_scores')+' SET version=version+1 WHERE id=$1::uuid',[ids.score]],
     ['UPDATE '+sessionTable('memberships')+" SET status='suspended' WHERE id=$1::uuid",[ids.admin]],
    ])await expectError('55P03',()=>client.begin(async tx=>{const bound=wrap(tx);await bound.unsafe("SET LOCAL lock_timeout='200ms'");await bound.unsafe(query,parameters);}));
    releaseComplete();assert.equal((await heldComplete).kind,'replay');
    let signalOwner,releaseOwner;
    const ownerReady=new Promise(resolve=>{signalOwner=resolve;});
    const ownerGate=new Promise(resolve=>{releaseOwner=resolve;});completeReleases.push(releaseOwner);
    const heldOwner=client.begin(async tx=>{
     const bound=wrap(tx);await bound.unsafe("SET LOCAL statement_timeout='10s'");
     await bound.unsafe('UPDATE '+sessionTable('memberships')+' SET role=role WHERE id=$1::uuid',[ids.admin]);
     signalOwner();await ownerGate;
    });heldOwner.catch(()=>{});completeHolders.push(heldOwner);
    await awaitFixtureAuthorityLock(heldOwner,ownerReady);
    let blockedCode=null,blockedWork=false;
    const boundedWriter={unsafe:writer.unsafe,begin:callback=>writer.begin(async bound=>{
     await bound.unsafe("SET LOCAL lock_timeout='200ms'");
     return callback({unsafe:async(query,parameters)=>{try{return await bound.unsafe(query,parameters);}catch(error){blockedCode=error.code;throw error;}}});
    })};
    assert.deepEqual(await executeCompleteFixtureReport(boundedWriter,sessionSchema,adminBinding,async()=>{blockedWork=true;return {ok:true};}),{ok:false,code:'transaction_failed'});
    assert.equal(blockedCode,'55P03');assert.equal(blockedWork,false);
    releaseOwner();await heldOwner;
    assert.equal((await completeAdmin((db,identity)=>executeFixtureReportWorkflow(db,sessionSchema,completeReturn,identity))).kind,'replay');
    assert.deepEqual(await reportHistory(),afterCompleteReturn);
    console.log('PASS: combined source/authority gate blocks source and membership writers in both arrival orders; retry retains exact report history');


    await writer.begin(async bound=>{
     await bound.unsafe('RESET ROLE');
     const reset=(await bound.unsafe('SELECT session_user AS login,current_user AS role'))[0];
     assert.equal(reset.login,loginPlan.login);assert.equal(reset.role,loginPlan.login);
    });
    await expectError('42501',()=>writer.begin(bound=>bound.unsafe('CREATE TABLE '+sessionTable('forbidden_table')+' (id int)')));
    await expectError('42501',()=>writer.begin(bound=>bound.unsafe('ALTER TABLE '+sessionTable('report_cards')+' DISABLE ROW LEVEL SECURITY')));
    assert.equal(inspectDisposableLogin(sessionSchema,await sql.unsafe(loginPlan.query,loginPlan.parameters)),true);
    console.log('PASS: service role reset returns to the unprivileged login; schema creation and RLS disabling are denied without privilege drift');
    throw cleanupProbe;
   } finally {
    // Marker ownership also permits cleanup if COMMIT succeeded but its client
    // acknowledgement was lost. Never drop a colliding pre-existing schema.
    if(releaseAssignmentReplay)releaseAssignmentReplay();
    if(assignmentReplay)await Promise.allSettled([assignmentReplay]);
    for(const release of completeReleases)release();
    await Promise.allSettled(completeHolders);
    if(loginClient)await loginClient.end();
    const markerExists=(await sql.unsafe('SELECT pg_catalog.to_regclass($1::text) IS NOT NULL AS present',[sessionTable('fixture_run_marker')]))[0].present;
    if(markerExists){
     const marker=await sql.unsafe('SELECT token FROM '+sessionTable('fixture_run_marker'));
     assert.equal(marker.length,1);assert.equal(marker[0].token,runToken,'refuse cleanup of a fixture owned by another run');
     await sql.unsafe('DROP SCHEMA '+q(sessionSchema)+' CASCADE');
     await sql.unsafe('REVOKE CONNECT ON DATABASE '+q(databaseName)+' FROM '+q(loginPlan.login));
     await sql.unsafe('DROP ROLE '+q(loginPlan.login));
     await sql.unsafe('DROP ROLE '+q(completePlan.owner));
     await sql.unsafe('DROP ROLE '+Object.values(sessionSecurity.roles).map(q).join(','));
    }else if(sessionCommitted)throw Error('Independent fixture marker missing; automatic cleanup refused for '+sessionSchema);
   }
   })(),error=>error===cleanupProbe);
   const removed=fixtureRolePreflightPlan(sessionSchema);
   assert.equal((await sql.unsafe(removed.query,removed.parameters)).length,0);
   assert.equal((await sql.unsafe(loginPlan.query,loginPlan.parameters)).length,0);
   assert.equal((await sql.unsafe('SELECT rolname FROM pg_catalog.pg_roles WHERE rolname=$1::text',[completePlan.owner])).length,0);
   assert.equal((await sql.unsafe('SELECT count(*)::int AS n FROM pg_catalog.pg_namespace WHERE nspname=$1::text',[sessionSchema]))[0].n,0);
   console.log('PASS: committed independent-session fixture and exact temporary roles are removed even after an intentional workload error');
  }else console.log('SKIPPED: eleven independent restricted-session/login/access-loss/complete-authority groups require the existing disposable role-admin confirmation');

 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS ' + q(schema) + ' CASCADE'); } finally { await client.end(); }
 }
}

