// Opt-in, schema-faithful fixture tests only. Never imports Drizzle Kit/config/env.
import assert from 'node:assert/strict';
import { readFixtureRelationalAssessment } from '../src/lib/academics/assessment-postgres-fixture-source-reader.ts';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from '../src/lib/academics/assessment-postgres-canonical-reader.ts';
import { executeFixtureReportWorkflow } from '../src/lib/academics/report-card-postgres-workflow-writer.ts';
import { executeFixtureCanonicalReportCommand } from '../src/lib/academics/report-card-postgres-canonical-writer.ts';
import { buildApprovedReportSnapshot } from '../src/lib/academics/report-card-approved-snapshot.ts';
import { canonicalizeSnapshotValue } from '../src/lib/academics/report-card-canonical-snapshot.ts';
import postgres from 'postgres';
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
 try {
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
  await sql.unsafe('UPDATE '+table('report_cards')+" SET stage='approved',published_at=NULL WHERE id=$1::uuid",[guardCreated.reportId]);
  try{assert.deepEqual(await runWorkflow({action:'reopen',reportId:guardCreated.reportId,expectedVersion:4,operationKey:'workflow-active-release'},adminAuth),{ok:false,code:'active_release'});}finally{await sql.unsafe('UPDATE '+table('report_cards')+" SET stage='published',published_at=now() WHERE id=$1::uuid",[guardCreated.reportId]);}
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
  assertIncrement(beforeParentCommit,await revisions(),allParentScopes);
  assert.equal((await readCanonical()).ok,false);
  await seal();
  assert.equal((await readCanonical()).ok,true);
  assert.deepEqual(await sql.unsafe('SELECT id,content_hash,canonical_payload FROM '+table('report_card_snapshots')+' ORDER BY id'),historyBeforeParent);
  const beforeAuthorityOnly=await revisions();
  await sql.unsafe('UPDATE '+table('memberships')+" SET status='active' WHERE id=$1::uuid",[ids.teacher]);
  assert.deepEqual(await revisions(),beforeAuthorityOnly);
  console.log('PASS: committed parent edits stale the source, fresh canonical finalization recovers and immutable report snapshots remain unchanged');

 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS ' + q(schema) + ' CASCADE'); } finally { await client.end(); }
 }
}
