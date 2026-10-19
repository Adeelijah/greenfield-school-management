// Opt-in, schema-faithful fixture tests only. Never imports Drizzle Kit/config/env.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
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
 } finally {
  try { await sql.unsafe('DROP SCHEMA IF EXISTS ' + q(schema) + ' CASCADE'); } finally { await client.end(); }
 }
}
