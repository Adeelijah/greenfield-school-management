// Opt-in, schema-faithful fixture tests only. Never imports Drizzle Kit/config/env.
import assert from 'node:assert/strict';
import { readFixtureRelationalAssessment } from '../src/lib/academics/assessment-postgres-fixture-source-reader.ts';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from '../src/lib/academics/assessment-postgres-canonical-reader.ts';
import { canonicalizeSnapshotValue } from '../src/lib/academics/report-card-canonical-snapshot.ts';
import postgres from 'postgres';
import { assessmentWriteGuardDDL } from './lib/assessment-disposable-write-guards.mjs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { assessmentFixtureDDL, fixtureTables, fixtureIdentifier as q } from './lib/assessment-disposable-schema.mjs';

const url = process.env.REPORT_CARD_TEST_DATABASE_URL;
if (!url || process.env.REPORT_CARD_TEST_CONFIRM !== 'DISPOSABLE_REPORT_CARD_TEST_ONLY') {
 console.error('SKIPPED: explicit disposable database URL and confirmation required.'); process.exitCode = 2;
} else {
 const parsed = new URL(url);
 if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw Error('Only a local disposable test database is permitted.');
 const schema = 'rc_it_' + randomBytes(8).toString('hex');
 const fixture = assessmentFixtureDDL(schema);
 const client = postgres(url, { max: 4, prepare: false, connect_timeout: 5, onnotice: () => {} });
 const wrap = tx => ({ unsafe: (query, parameters = []) => tx.unsafe(query, parameters.map(v => typeof v === 'string' ? client.typed(v, 25) : v)) });
 const sql = wrap(client); const table = fixture.table;
 const configs = new Map(fixtureTables.map(t => { const c = getTableConfig(t); return [c.name, c]; }));
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
  console.log('PASS: all 22 fixture relations created from actual metadata with isolated prerequisites');
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
  const seal = (bad = null) => client.begin(async tx => {
   const bound = wrap(tx);
   await bound.unsafe(guards.readGate.replace('FOR SHARE', 'FOR UPDATE'));
   await bound.unsafe('UPDATE ' + table('assessment_scores') + ' SET version=version+1 WHERE id=$1::uuid', [editableScore]);
   const loaded = await loadFixtureCompleteAssessment(bound, schema, scopeSelector, verifyIdentity);
   assert.equal(loaded.ok, true, JSON.stringify(loaded));
   assert.equal(loaded.input.students.length, 2);
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



 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS ' + q(schema) + ' CASCADE'); } finally { await client.end(); }
 }
}
