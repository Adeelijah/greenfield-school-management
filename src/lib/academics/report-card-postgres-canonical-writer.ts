// Fixture-only approval/publication adapter. No app route, driver or environment.
import { createHash, randomUUID } from 'node:crypto';
import type { SqlDatabase } from './report-card-postgres-disposable-adapter';
import type { ApprovedReportBinding } from './report-card-approved-snapshot';
// @ts-expect-error Node type stripping requires explicit source extension.
import { fixtureAssessmentDecoders as d } from './assessment-postgres-fixture-source-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { mapPersistedReportIdentity } from './report-card-persisted-model-map.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { readFixtureVerifiedCanonicalAssessment } from './assessment-postgres-canonical-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { buildApprovedReportSnapshot, matchesApprovedReportSnapshot } from './report-card-approved-snapshot.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { canonicalizeSnapshotValue } from './report-card-canonical-snapshot.ts';
export type CanonicalReportCommand = { reportId: string; action: 'approve' | 'publish'; expectedVersion: number; operationKey: string };
export type CanonicalReportOutcome = { ok: true; kind: 'applied' | 'replay'; version: number; snapshotId: string; stage: 'approved' | 'published' } | { ok: false; code: string };
class FixtureReportAbort extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
const abort = (code: string): never => { throw new FixtureReportAbort(code); };
/** Owns the outer transaction; all post-write failures escape begin before being
 * mapped to generic outcomes. It never changes assessment sources or upgrades
 * their shared discovery lock. Only approve/publish of EXISTING reports is in
 * scope; creation, submit/return/reopen and production authentication are absent.
 */
export async function executeFixtureCanonicalReportCommand(db: SqlDatabase, schema: string, raw: CanonicalReportCommand,
 verifiedIdentity: () => Promise<{ authUserId: string } | null>,
): Promise<CanonicalReportOutcome> {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema) || !raw || !['approve','publish'].includes(raw.action) || typeof raw.reportId !== 'string' || !raw.reportId.trim() || typeof raw.operationKey !== 'string' || !raw.operationKey.trim() || raw.operationKey.length > 128 || !Number.isSafeInteger(raw.expectedVersion) || raw.expectedVersion < 1) return { ok: false, code: 'invalid' };
 const command = { reportId: raw.reportId, action: raw.action, expectedVersion: raw.expectedVersion, operationKey: raw.operationKey };
 const table = (name: string) => '"' + schema + '"."' + name + '"';
 try {
  return await db.begin(async tx => {
   const auth = await verifiedIdentity(); if (!auth?.authUserId?.trim()) return abort('unauthenticated');
   if ((await tx.unsafe('SELECT id FROM ' + table('fixture_source_write_gate') + ' WHERE id=1 FOR SHARE')).length !== 1) return abort('transaction_failed');
   const users = await tx.unsafe('SELECT id,auth_user_id AS "authUserId" FROM ' + table('school_users') + ' WHERE auth_user_id=$1::uuid FOR SHARE', [auth.authUserId]);
   if (users.length !== 1) return abort('forbidden');
   const memberships = await tx.unsafe('SELECT id,school_id AS "schoolId",user_id AS "userId",role,status FROM ' + table('memberships') + ' WHERE user_id=$1::uuid ORDER BY id FOR SHARE', [users[0]!.id]);
   const schools = await tx.unsafe('SELECT id,final_primary_year AS "finalPrimaryYear" FROM ' + table('schools') + ' WHERE id IN (SELECT school_id FROM ' + table('memberships') + ' WHERE user_id=$1::uuid) ORDER BY id FOR SHARE', [users[0]!.id]);
   const mapped = mapPersistedReportIdentity(auth.authUserId, d.decodeIdentityRows({ users, memberships, schools }));
   if (!mapped.ok || mapped.identity.membership.role !== 'admin') return abort('forbidden');
   const schoolId = mapped.identity.school.id, actorId = mapped.identity.membership.id;
   const reports = await tx.unsafe('SELECT id,school_id AS "schoolId",enrollment_id AS "enrollmentId",student_id AS "studentId",class_id AS "classId",session_id AS "sessionId",term_id AS "termId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",stage,version,submitted_by AS "submittedBy",approved_by AS "approvedBy" FROM ' + table('report_cards') + ' WHERE school_id=$1::uuid AND id=$2::uuid FOR UPDATE', [schoolId, command.reportId]);
   if (reports.length !== 1) return abort('not_found');
   const row = reports[0]!;
   const report = { id: d.textField(row.id), schoolId: d.textField(row.schoolId), enrollmentId: d.textField(row.enrollmentId), studentId: d.textField(row.studentId), classId: d.textField(row.classId), sessionId: d.textField(row.sessionId), termId: d.textField(row.termId), assessmentScopeId: d.textField(row.assessmentScopeId), assessmentSourceVersionId: d.textField(row.assessmentSourceVersionId), assessmentRevision: d.integerField(row.assessmentRevision), version: d.integerField(row.version), stage: d.enumField(row.stage, ['draft','submitted','returned','approved','published'] as const), submittedBy: d.nullableText(row.submittedBy), approvedBy: d.nullableText(row.approvedBy) };
   if (report.id !== command.reportId || report.schoolId !== schoolId) return abort('not_found');
   const fingerprint = createHash('sha256').update(canonicalizeSnapshotValue({ schoolId, actorId, reportId: report.id, action: command.action, expectedVersion: command.expectedVersion })).digest('hex');
   const receipts = await tx.unsafe('SELECT report_id AS "reportId",fingerprint,resulting_version AS "resultingVersion",outcome FROM ' + table('report_card_operation_receipts') + ' WHERE school_id=$1::uuid AND actor_membership_id=$2::uuid AND operation_key=$3::text FOR SHARE', [schoolId, actorId, command.operationKey]);
   const stage = command.action === 'approve' ? 'approved' as const : 'published' as const;
   if (receipts.length) {
    if (receipts.length !== 1 || receipts[0]!.reportId !== report.id || receipts[0]!.fingerprint !== fingerprint) return abort('idempotency_conflict');
    const receipt = receipts[0]!; const outcome = d.decoded<Record<string, unknown>>(receipt.outcome);
    const version = d.integerField(receipt.resultingVersion), snapshotId = d.textField(outcome.snapshotId);
    if (outcome.ok !== true || outcome.kind !== 'applied' || outcome.stage !== stage || outcome.version !== version || version < 1 || version > report.version) return abort('invalid_receipt');
    const pin = await tx.unsafe('SELECT id FROM ' + table('report_card_snapshots') + ' WHERE school_id=$1::uuid AND report_id=$2::uuid AND id=$3::uuid AND report_version=$4 FOR SHARE', [schoolId, report.id, snapshotId, command.action === 'approve' ? version : version - 1]);
    if (pin.length !== 1) return abort('invalid_receipt');
    return { ok: true, kind: 'replay', version, snapshotId, stage } as const;
   }
   if (report.version !== command.expectedVersion) return abort('stale_version');
   if (report.version < (command.action === 'approve' ? 2 : 3) || report.stage !== (command.action === 'approve' ? 'submitted' : 'approved')) return abort('invalid_transition');
   if (!report.submittedBy || report.submittedBy === actorId) return abort('forbidden');
   const submitters = await tx.unsafe('SELECT m.id FROM ' + table('memberships') + ' m JOIN ' + table('teacher_class_assignments') + " a ON a.school_id=m.school_id AND a.teacher_membership_id=m.id WHERE m.school_id=$1::uuid AND m.id=$2::uuid AND m.role='teacher' AND m.status='active' AND a.class_id=$3::uuid AND a.session_id=$4::uuid AND a.ended_at IS NULL FOR SHARE OF m,a", [schoolId, report.submittedBy, report.classId, report.sessionId]);
   if (submitters.length !== 1) return abort('forbidden');
   const loaded = await readFixtureVerifiedCanonicalAssessment(tx, schema, { classId: report.classId, sessionId: report.sessionId, termId: report.termId }, async () => ({ authUserId: auth.authUserId }));
   if (!loaded.ok) return abort(loaded.code);
   if (loaded.identity.membership.id !== actorId || loaded.input.scope.id !== report.assessmentScopeId || loaded.input.scope.revision !== report.assessmentRevision || loaded.sourceVersionId !== report.assessmentSourceVersionId) return abort('stale_source');
   const now = new Date().toISOString();
   let snapshotId: string; let approvedVersion: number;
   if (command.action === 'approve') {
    approvedVersion = report.version + 1;
    const binding: ApprovedReportBinding = { ...report, approvedVersion, submittedBy: report.submittedBy, approvedBy: actorId, approvedAt: now };
    // Copy exact snapshot binding fields; never persist mutable stage/version or
    // caller metadata through an accidental spread into the canonical payload.
    const built = buildApprovedReportSnapshot(snapshotBinding(binding), loaded.documents);
    if (!built.ok) return abort(built.code);
    snapshotId = randomUUID(); const snapshot = built.snapshot;
    await tx.unsafe('INSERT INTO ' + table('report_card_snapshots') + ' (id,school_id,report_id,report_version,enrollment_id,assessment_scope_id,assessment_source_version_id,assessment_revision,source_versions,content_hash,canonical_payload) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6::uuid,$7::uuid,$8,$9::text::jsonb,$10::text,$11::text::jsonb)', [snapshotId,schoolId,report.id,approvedVersion,report.enrollmentId,report.assessmentScopeId,report.assessmentSourceVersionId,report.assessmentRevision,JSON.stringify(snapshot.sourceVersions),snapshot.sha256,snapshot.canonicalJson]);
   } else {
    if (!report.approvedBy || report.approvedBy === report.submittedBy) return abort('forbidden');
    const approvers = await tx.unsafe('SELECT id FROM ' + table('memberships') + " WHERE school_id=$1::uuid AND id=$2::uuid AND role='admin' AND status='active' FOR SHARE", [schoolId, report.approvedBy]);
    if (approvers.length !== 1) return abort('forbidden');
    approvedVersion = report.version;
    const snapshots = await tx.unsafe('SELECT id,school_id AS "schoolId",report_id AS "reportId",report_version AS "reportVersion",enrollment_id AS "enrollmentId",assessment_scope_id AS "assessmentScopeId",assessment_source_version_id AS "assessmentSourceVersionId",assessment_revision AS "assessmentRevision",canonical_payload AS "canonicalPayload",content_hash AS "contentHash",source_versions AS "sourceVersions" FROM ' + table('report_card_snapshots') + ' WHERE school_id=$1::uuid AND report_id=$2::uuid AND report_version=$3 FOR SHARE', [schoolId, report.id, approvedVersion]);
    if (snapshots.length !== 1) return abort('snapshot_mismatch');
    const saved = snapshots[0]!; snapshotId = d.textField(saved.id);
    const payload = d.decoded<Record<string, unknown>>(saved.canonicalPayload);
    const savedBinding = d.decoded<Record<string, unknown>>(payload.binding);
    const binding: ApprovedReportBinding = { ...report, approvedVersion, submittedBy: report.submittedBy, approvedBy: report.approvedBy, approvedAt: d.textField(savedBinding.approvedAt) };
    const built = buildApprovedReportSnapshot(snapshotBinding(binding), loaded.documents);
    if (!built.ok || saved.schoolId !== schoolId || saved.reportId !== report.id || saved.reportVersion !== approvedVersion || saved.enrollmentId !== report.enrollmentId || saved.assessmentScopeId !== report.assessmentScopeId || saved.assessmentSourceVersionId !== report.assessmentSourceVersionId || saved.assessmentRevision !== report.assessmentRevision || !matchesApprovedReportSnapshot(built.snapshot, { canonicalPayload: saved.canonicalPayload, contentHash: d.textField(saved.contentHash), sourceVersions: saved.sourceVersions })) return abort('snapshot_mismatch');
   }
   const version = report.version + 1;
   const updated = command.action === 'approve'
    ? await tx.unsafe('UPDATE ' + table('report_cards') + " SET stage='approved',version=$3,approved_by=$4::uuid WHERE school_id=$1::uuid AND id=$2::uuid AND version=$5 AND stage='submitted' RETURNING id", [schoolId,report.id,version,actorId,report.version])
    : await tx.unsafe('UPDATE ' + table('report_cards') + " SET stage='published',version=$3,published_at=$4::timestamptz WHERE school_id=$1::uuid AND id=$2::uuid AND version=$5 AND stage='approved' RETURNING id", [schoolId,report.id,version,now,report.version]);
   if (updated.length !== 1) return abort('stale_version');
   await tx.unsafe('INSERT INTO ' + table('report_card_audit') + ' (id,school_id,report_id,actor_membership_id,action,before_stage,after_stage,before_version,after_version,snapshot_id,snapshot_report_version,occurred_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text::' + table('report_card_action') + ',$6::text::' + table('report_card_stage') + ',$7::text::' + table('report_card_stage') + ',$8,$9,$10::uuid,$11,$12::timestamptz)', [randomUUID(),schoolId,report.id,actorId,command.action,report.stage,stage,report.version,version,snapshotId,approvedVersion,now]);
   if (command.action === 'publish') await tx.unsafe('INSERT INTO ' + table('report_card_releases') + ' (id,school_id,report_id,report_version,snapshot_id,snapshot_report_version,published_by,released_at) VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7::uuid,$8::timestamptz)', [randomUUID(),schoolId,report.id,version,snapshotId,approvedVersion,actorId,now]);
   const outcome = { ok: true, kind: 'applied', version, snapshotId, stage } as const;
   await tx.unsafe('INSERT INTO ' + table('report_card_operation_receipts') + ' (school_id,report_id,actor_membership_id,operation_key,fingerprint,resulting_version,outcome) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6,$7::text::jsonb)', [schoolId,report.id,actorId,command.operationKey,fingerprint,version,JSON.stringify(outcome)]);
   return outcome;
  });
 } catch (error) { return { ok: false, code: error instanceof FixtureReportAbort ? error.code : 'transaction_failed' }; }
}
function snapshotBinding(b: ApprovedReportBinding): ApprovedReportBinding {
 return { id:b.id,schoolId:b.schoolId,enrollmentId:b.enrollmentId,studentId:b.studentId,classId:b.classId,sessionId:b.sessionId,termId:b.termId,assessmentScopeId:b.assessmentScopeId,assessmentSourceVersionId:b.assessmentSourceVersionId,assessmentRevision:b.assessmentRevision,approvedVersion:b.approvedVersion,submittedBy:b.submittedBy,approvedBy:b.approvedBy,approvedAt:b.approvedAt };
}
