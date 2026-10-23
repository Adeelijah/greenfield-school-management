// Opt-in workload on the upgraded generated schema and actual restricted LOGIN.
// Fixture identity callbacks are not SDK authentication or request credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';
import { disposableSessionRendezvous } from './disposable-session-rendezvous.mjs';
import { loadFixtureCompleteAssessment, readFixtureVerifiedCanonicalAssessment } from '../../src/lib/academics/assessment-postgres-canonical-reader.ts';
import { executeCompleteFixtureReport } from '../../src/lib/academics/report-card-complete-fixture-boundary.ts';
import { executeFixtureReportWorkflow } from '../../src/lib/academics/report-card-postgres-workflow-writer.ts';
import { executeFixtureCanonicalReportCommand } from '../../src/lib/academics/report-card-postgres-canonical-writer.ts';
import { executeFixtureReportRevocation } from '../../src/lib/academics/report-card-postgres-revoke-writer.ts';
import { probeUpgradeServerEntry } from './report-card-upgrade-server-entry-probe.mjs';

export async function probeUpgradeWorkflow(db, restricted, schema, schoolId, adminUserId, adminMembershipId) {
  const q = upgradeFixtureSchema(schema), table = name => q + '."' + name + '"';
  const ids = Object.fromEntries(['teacherUser', 'teacherAuth', 'teacher', 'session', 'term', 'level', 'section', 'class', 'assignment', 'subject', 'config', 'scope', 'roster'].map(key => [key, randomUUID()]));
  const pupils = [0, 1, 2].map(index => ({ student: randomUUID(), enrollment: randomUUID(), score: randomUUID(), mark: ['86.0000', '69.9950', '55.0000'][index] }));
  const insert = (tx, name, row) => {
    const keys = Object.keys(row), values = keys.map(key => row[key] !== null && typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key]);
    const parameters = keys.map((key, i) => '$' + (i + 1) + (row[key] !== null && typeof row[key] === 'object' ? '::text::jsonb' : ''));
    return tx.unsafe('INSERT INTO ' + table(name) + ' (' + keys.map(key => '"' + key + '"').join(',') + ') VALUES (' + parameters.join(',') + ')', values);
  };
  const adminAuth = (await db.unsafe('SELECT auth_user_id FROM ' + table('school_users') + ' WHERE id=$1::uuid', [adminUserId]))[0].auth_user_id;
  const admin = { authUserId: adminAuth, schoolUserId: adminUserId, membershipId: adminMembershipId, schoolId };
  const teacher = { authUserId: ids.teacherAuth, schoolUserId: ids.teacherUser, membershipId: ids.teacher, schoolId };
  const selector = { classId: ids.class, sessionId: ids.session, termId: ids.term };
  await db.begin(async tx => {
    await insert(tx, 'school_users', { id: ids.teacherUser, auth_user_id: ids.teacherAuth, display_name: 'Upgrade fictional teacher' });
    await insert(tx, 'memberships', { id: ids.teacher, school_id: schoolId, user_id: ids.teacherUser, role: 'teacher' });
    await insert(tx, 'academic_sessions', { id: ids.session, school_id: schoolId, label: 'Upgrade command session', starts_on: '2026-09-01', ends_on: '2027-07-31' });
    await insert(tx, 'terms', { id: ids.term, school_id: schoolId, session_id: ids.session, name: 'First Term', starts_on: '2026-09-01', ends_on: '2026-12-18' });
    await insert(tx, 'academic_levels', { id: ids.level, school_id: schoolId, name: 'Upgrade Primary 5', stage: 'primary', primary_year: 5, progression_order: 5 });
    await insert(tx, 'academic_sections', { id: ids.section, school_id: schoolId, level_id: ids.level, name: 'Upgrade Cedar', display_order: 1 });
    await insert(tx, 'classes', { id: ids.class, school_id: schoolId, name: 'Upgrade Primary 5 Cedar', section: 'Cedar', level_id: ids.level, section_id: ids.section });
    await insert(tx, 'teacher_class_assignments', { id: ids.assignment, school_id: schoolId, teacher_membership_id: ids.teacher, class_id: ids.class, session_id: ids.session });
    await insert(tx, 'assessment_subjects', { id: ids.subject, school_id: schoolId, code: 'UPGRADE-MATH', name: 'Upgrade Mathematics' });
    await insert(tx, 'assessment_config_versions', { id: ids.config, school_id: schoolId, config_key: randomUUID(), revision: 1, level_id: ids.level, session_id: ids.session, term_id: ids.term, subject_id: ids.subject, mode: 'numeric', state: 'finalized',
      components: [{ id: 'exam', label: 'Exam', category: 'exam', weight: 100, maximumScore: 100, required: true }], grading: { mode: 'numeric', bands: [{ min: 0, max: 100, label: 'A' }] } });
    await insert(tx, 'assessment_scopes', { id: ids.scope, school_id: schoolId, class_id: ids.class, session_id: ids.session, term_id: ids.term });
    await insert(tx, 'assessment_subject_roster', { id: ids.roster, school_id: schoolId, scope_id: ids.scope, subject_id: ids.subject, config_version_id: ids.config });
    await insert(tx, 'assessment_teacher_subjects', { school_id: schoolId, roster_id: ids.roster, class_assignment_id: ids.assignment });
    for (const [index, pupil] of pupils.entries()) {
      await insert(tx, 'students', { id: pupil.student, school_id: schoolId, admission_number: 'UPGRADE-COMMAND-' + index, first_name: 'Fictional', last_name: 'Upgrade pupil ' + index });
      await insert(tx, 'enrollments', { id: pupil.enrollment, school_id: schoolId, student_id: pupil.student, class_id: ids.class, session_id: ids.session });
      await insert(tx, 'assessment_scores', { id: pupil.score, school_id: schoolId, roster_id: ids.roster, config_version_id: ids.config, enrollment_id: pupil.enrollment, student_id: pupil.student, component_key: 'exam', numeric_score: pupil.mark, updated_by: ids.teacher });
    }
    // Seed writer owns the EXCLUSIVE source gate before the candidate reader.
    await tx.unsafe('SELECT id FROM ' + table('fixture_source_write_gate') + ' WHERE id=1 FOR UPDATE');
    const loaded = await loadFixtureCompleteAssessment(tx, schema, selector, async () => ({ authUserId: adminAuth }));
    assert.equal(loaded.ok, true, JSON.stringify(loaded));
    assert.equal(loaded.input.students.length, 3);
    const sourceId = randomUUID();
    await insert(tx, 'assessment_source_versions', { id: sourceId, school_id: schoolId, scope_id: ids.scope, revision: loaded.input.scope.revision, source_manifest: JSON.parse(loaded.materialized.manifest.canonicalJson), content_hash: loaded.materialized.manifest.sha256 });
    for (const subject of loaded.materialized.subjects) {
      const reviewId = randomUUID();
      await insert(tx, 'assessment_teacher_reviews', { id: reviewId, school_id: schoolId, scope_id: ids.scope, roster_id: subject.rosterId, source_version_id: sourceId, reviewer_membership_id: ids.teacher });
      await insert(tx, 'assessment_finalizations', { id: randomUUID(), school_id: schoolId, scope_id: ids.scope, roster_id: subject.rosterId, source_version_id: sourceId, teacher_review_id: reviewId, finalized_by: adminMembershipId, results: JSON.parse(subject.results.canonicalJson), content_hash: subject.results.sha256 });
    }
  });
  const asWriter = work => restricted.begin(async tx => {
    await tx.unsafe('SET LOCAL ROLE "' + schema + '_writer"');
    await tx.unsafe("SET LOCAL statement_timeout='5s'");
    const evidence = (await tx.unsafe('SELECT session_user AS login,current_user AS role,pg_catalog.pg_backend_pid() AS pid'))[0];
    assert.equal(evidence.login, schema + '_login'); assert.equal(evidence.role, schema + '_writer');
    return work(tx, evidence);
  });
  const verified = await asWriter(tx => readFixtureVerifiedCanonicalAssessment(tx, schema, selector, async () => ({ authUserId: adminAuth })));
  assert.equal(verified.ok, true, JSON.stringify(verified));
  assert.equal(verified.input.enrollments.length, 3);
  assert.deepEqual(JSON.parse(verified.materialized.subjects[0].results.canonicalJson).students.map(p => p.result.total).sort(), ['55.00', '70.00', '86.00']);
  console.log('PASS: upgraded restricted LOGIN verifies a complete three-pupil canonical source from real relational rows and JSONB finalizations');

  const history = async () => {
    const rows = {};
    for (const name of ['report_cards', 'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts', 'report_card_releases']) rows[name] = await db.unsafe('SELECT * FROM ' + table(name) + ' ORDER BY id');
    return JSON.parse(JSON.stringify(rows));
  };
  const dispatch = (scoped, command, identity) => command.action === 'approve' || command.action === 'publish'
    ? executeFixtureCanonicalReportCommand(scoped, schema, command, identity)
    : command.action === 'revoke' ? executeFixtureReportRevocation(scoped, schema, command, identity)
      : executeFixtureReportWorkflow(scoped, schema, command, identity);
  const run = (actor, command, { fault, barrier, rejectAfterSuccess = false } = {}) => executeCompleteFixtureReport({
    begin: callback => asWriter(async (tx, evidence) => { if (barrier) await barrier.arrive(evidence.pid, evidence.role); return callback(tx); }),
  }, schema, actor, async (scoped, identity) => {
    const intercepted = fault ? { begin: callback => scoped.begin(tx => callback({ unsafe: async (query, params) => {
      const result = await tx.unsafe(query, params);
      if ((query.startsWith('INSERT INTO ' + table(fault)) || query.startsWith('UPDATE ' + table(fault)))) throw Error('Injected upgraded persistence failure after write');
      return result;
    } })) } : scoped;
    const result = await dispatch(intercepted, command, identity);
    if (rejectAfterSuccess) { assert.equal(result.ok, true, JSON.stringify(result)); return { ok: false, code: 'fixture_rejected' }; }
    return result;
  });
  const applied = outcome => { assert.equal(outcome.ok, true, JSON.stringify(outcome)); assert.equal(outcome.kind, 'applied'); return outcome; };
  const replay = async (actor, command, expected) => {
    const before = await history();
    assert.deepEqual(await run(actor, command), { ...expected, kind: 'replay' });
    assert.deepEqual(await history(), before);
  };
  const pair = async (actor, command) => {
    const before = await history();
    const barrier = disposableSessionRendezvous(schema + '_writer');
    try {
      const settled = await Promise.allSettled([0, 1].map(() => run(actor, command, { barrier })));
      for (const result of settled) if (result.status === 'rejected') throw result.reason;
      const outcomes = settled.map(result => result.value);
      assert.deepEqual(outcomes.map(outcome => outcome.kind).sort(), ['applied', 'replay'], JSON.stringify(outcomes));
      const result = applied(outcomes.find(outcome => outcome.kind === 'applied'));
      assert.deepEqual(outcomes.find(outcome => outcome.kind === 'replay'), { ...result, kind: 'replay' });
      const after = await history();
      for (const [name, added] of [['report_cards', command.action === 'create' ? 1 : 0], ['report_card_snapshots', command.action === 'approve' ? 1 : 0], ['report_card_releases', command.action === 'publish' ? 1 : 0], ['report_card_audit', 1], ['report_card_operation_receipts', 1]]) assert.equal(after[name].length, before[name].length + added, command.action + ':' + name);
      await replay(actor, command, result);
      return result;
    } finally { barrier.cancel(); }
  };
  const creation = (pupil, operationKey) => ({ action: 'create', operationKey, studentId: pupil.student, enrollmentId: pupil.enrollment, ...selector });
  const change = (action, reportId, expectedVersion, operationKey, extra = {}) => ({ action, reportId, expectedVersion, operationKey, ...extra });
  const created = await pair(teacher, creation(pupils[0], 'upgrade-create'));
  const submitCommand = change('submit', created.reportId, 1, 'upgrade-submit');
  const submitted = await pair(teacher, submitCommand);
  assert.equal(submitted.version, 2);
  const unchanged = await history();
  assert.deepEqual(await run(teacher, { ...submitCommand, expectedVersion: 2 }), { ok: false, code: 'idempotency_conflict' });
  assert.deepEqual(await history(), unchanged);
  console.log('PASS: distinct upgraded LOGIN backends serialize real creation/submission, replay once and reject changed fingerprints without history changes');

  const approveCommand = change('approve', created.reportId, 2, 'upgrade-approve');
  const beforeTeacherApproval = await history();
  assert.deepEqual(await run(teacher, approveCommand), { ok: false, code: 'forbidden' });
  assert.deepEqual(await history(), beforeTeacherApproval);
  const approved = await pair(admin, approveCommand);
  const publishCommand = change('publish', created.reportId, 3, 'upgrade-publish');
  const published = await pair(admin, publishCommand);
  assert.equal(published.snapshotId, approved.snapshotId);
  const snapshotRows = await db.unsafe('SELECT * FROM ' + table('report_card_snapshots') + ' WHERE report_id=$1::uuid', [created.reportId]);
  assert.equal(snapshotRows.length, 1);
  const snapshot = JSON.parse(JSON.stringify(snapshotRows[0]));
  assert.equal(snapshot.canonical_payload.binding.studentId, pupils[0].student);
  assert.equal(snapshot.canonical_payload.binding.enrollmentId, pupils[0].enrollment);
  assert.equal(JSON.stringify(snapshot.canonical_payload).includes(pupils[1].enrollment), false);
  assert.equal(JSON.stringify(snapshot.canonical_payload).includes(pupils[2].enrollment), false);
  assert.equal((await db.unsafe('SELECT id FROM ' + table('report_card_releases') + ' WHERE report_id=$1::uuid', [created.reportId])).length, 1);
  console.log('PASS: upgraded restricted approval/publication pairs apply once and share one immutable pupil-specific approved snapshot and release');

  const retry = async (actor, command, faults) => {
    for (const fault of faults) {
      const before = await history();
      assert.deepEqual(await run(actor, command, { fault }), { ok: false, code: 'transaction_failed' }, command.action + ':' + fault);
      assert.deepEqual(await history(), before, command.action + ':' + fault + ' rollback');
    }
    const result = applied(await run(actor, command));
    await replay(actor, command, result);
    return result;
  };
  const createRetry = creation(pupils[1], 'upgrade-retry-create');
  const beforeRejected = await history();
  assert.deepEqual(await run(teacher, createRetry, { rejectAfterSuccess: true }), { ok: false, code: 'fixture_rejected' });
  assert.deepEqual(await history(), beforeRejected);
  const second = await retry(teacher, createRetry, ['report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  const transition = (action, version, extra) => change(action, second.reportId, version, 'upgrade-retry-' + action + '-' + version, extra);
  await retry(teacher, transition('submit', 1), ['report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  await retry(admin, transition('return', 2, { reason: 'Fictional correction review' }), ['report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  await retry(teacher, transition('submit', 3), ['report_card_operation_receipts']);
  const firstPin = await retry(admin, transition('approve', 4), ['report_card_snapshots', 'report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  const firstPinRows = JSON.parse(JSON.stringify(await db.unsafe('SELECT * FROM ' + table('report_card_snapshots') + ' WHERE id=$1::uuid', [firstPin.snapshotId])));
  await retry(admin, transition('reopen', 5), ['report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  await retry(teacher, transition('submit', 6), ['report_card_operation_receipts']);
  const nextPin = await retry(admin, transition('approve', 7), ['report_card_operation_receipts']);
  assert.notEqual(firstPin.snapshotId, nextPin.snapshotId);
  await retry(admin, transition('publish', 8), ['report_cards', 'report_card_audit', 'report_card_releases', 'report_card_operation_receipts']);
  const secondRelease = (await db.unsafe('SELECT id FROM ' + table('report_card_releases') + ' WHERE report_id=$1::uuid AND revoked_at IS NULL', [second.reportId]))[0].id;
  await retry(admin, transition('revoke', 9, { releaseId: secondRelease, reason: 'Fictional withdrawal' }), ['report_card_releases', 'report_cards', 'report_card_audit', 'report_card_operation_receipts']);
  assert.deepEqual(JSON.parse(JSON.stringify(await db.unsafe('SELECT * FROM ' + table('report_card_snapshots') + ' WHERE id=$1::uuid', [firstPin.snapshotId]))), firstPinRows);
  assert.equal((await db.unsafe('SELECT id FROM ' + table('report_card_snapshots') + ' WHERE report_id=$1::uuid', [second.reportId])).length, 2);
  console.log('PASS: all seven upgraded command actions roll back injected post-write failures; same-key retry/replay and outer rejection preserve exact history');

  await probeUpgradeServerEntry({ db, asWriter, schema, schoolId, admin, teacher, selector, pupil: pupils[2], assignmentId: ids.assignment, history });

  const frozen = JSON.parse(JSON.stringify(await db.unsafe('SELECT * FROM ' + table('report_card_snapshots') + ' ORDER BY id')));
  await db.unsafe('UPDATE ' + table('assessment_scores') + ' SET version=version+1 WHERE id=$1::uuid', [pupils[1].score]);
  await replay(admin, publishCommand, published);
  const beforeStale = await history();
  assert.deepEqual(await run(teacher, transition('submit', 10)), { ok: false, code: 'incomplete_source' });
  assert.deepEqual(await history(), beforeStale);
  const firstRelease = (await db.unsafe('SELECT id FROM ' + table('report_card_releases') + ' WHERE report_id=$1::uuid AND revoked_at IS NULL', [created.reportId]))[0].id;
  const revokeCommand = change('revoke', created.reportId, 4, 'upgrade-stale-revoke', { releaseId: firstRelease, reason: 'Withdraw stale fictional publication' });
  await pair(admin, revokeCommand);
  await db.unsafe('UPDATE ' + table('teacher_class_assignments') + ' SET ended_at=now() WHERE id=$1::uuid', [ids.assignment]);
  const beforeDenied = await history();
  assert.deepEqual(await run(teacher, submitCommand), { ok: false, code: 'forbidden' });
  await db.unsafe('UPDATE ' + table('memberships') + " SET status='suspended' WHERE id=$1::uuid", [adminMembershipId]);
  assert.deepEqual(await run(admin, publishCommand), { ok: false, code: 'forbidden' });
  await db.unsafe('UPDATE ' + table('memberships') + " SET status='active' WHERE id=$1::uuid", [adminMembershipId]);
  await replay(admin, publishCommand, published);
  assert.deepEqual(await history(), beforeDenied);
  assert.deepEqual(JSON.parse(JSON.stringify(await db.unsafe('SELECT * FROM ' + table('report_card_snapshots') + ' ORDER BY id'))), frozen);
  console.log('PASS: upgraded stale-source withdrawal preserves immutable snapshots and historical replay while ended assignment and suspension deny receipt access');
}
