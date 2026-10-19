// Test-only SQL read port. Synthetic rc_it tables, never application tables.
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { AuthoritativeReportReadPort, AuthBoundMembership, AcademicReadBundle } from './report-card-authoritative-read';
import type { ReportRecord } from './report-card-workflow';
import type { TeacherClassAssignment } from './assignments';
import type { TrustedEnrollmentRow, TrustedSubjectRow } from './report-card-trusted-source';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Expected decoded JSONB object');
  return value as Record<string, unknown>;
}
/** Connection MUST be an already-open transaction. Verified identity is a
 * server-owned callback; fictional in tests, not an authentication implementation.
 * Locks are held by that transaction, not by this factory's lifetime.
 */
export function disposableAuthoritativeReadPort(
  connection: SqlClient,
  schema: string,
  identity: () => Promise<{ authUserId: string } | null>,
): AuthoritativeReportReadPort {
  if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only generated disposable test schema identifiers allowed.');
  const table = (name: string) => '"' + schema + '"."' + name + '"';
  let verifiedUser: string | null = null;
  let membership: AuthBoundMembership | null = null;
  let report: ReportRecord | null = null;
  const scope = (record: ReportRecord) => {
    if (!report || record !== report) throw Error('Locked report required');
    return [record.schoolId, record.classId, record.sessionId, record.termId];
  };
  return {
    async verifiedIdentity() {
      const verified = await identity();
      verifiedUser = verified?.authUserId ?? null;
      return verified;
    },
    async lockMemberships(authUserId) {
      if (!verifiedUser || authUserId !== verifiedUser || membership) throw Error('Verified identity required');
      // Guard exists independently of memberships: mutations lock it FOR UPDATE,
      // including inserts/deletes, so absent/duplicate assignment rows are covered.
      const guards = await connection.unsafe('SELECT auth_user_id FROM ' + table('read_identities') + ' WHERE auth_user_id=$1 FOR SHARE', [authUserId]);
      if (guards.length !== 1) return [];
      const rows = await connection.unsafe('SELECT * FROM ' + table('read_memberships') + ' WHERE auth_user_id=$1 ORDER BY school_id,id FOR SHARE', [authUserId]);
      const members = rows.map(row => ({ id: row.id, authUserId: row.auth_user_id, schoolId: row.school_id, role: row.role, status: row.status } as AuthBoundMembership));
      if (members.length === 1) membership = members[0]!;
      return members;
    },
    async lockReport(schoolId, reportId) {
      if (!membership || membership.schoolId !== schoolId || membership.status !== 'active' || !['teacher', 'admin'].includes(membership.role)) throw Error('Active scoped membership required');
      const rows = await connection.unsafe('SELECT * FROM ' + table('read_reports') + ' WHERE school_id=$1 AND id=$2 FOR UPDATE', [schoolId, reportId]);
      if (rows.length !== 1) return null;
      report = object(rows[0].record) as ReportRecord;
      if (report.schoolId !== schoolId) throw Error('Report column/payload school mismatch');
      return { id: rows[0].id as string, enrollmentId: rows[0].enrollment_id as string, record: report };
    },
    async readAssignments(schoolId, membershipId) {
      if (!report || !membership || membership.schoolId !== schoolId || membership.id !== membershipId) throw Error('Locked scoped report required');
      const rows = await connection.unsafe('SELECT * FROM ' + table('read_assignments') + ' WHERE school_id=$1 AND membership_id=$2 ORDER BY id FOR SHARE', [schoolId, membershipId]);
      return rows.map(row => ({ id: row.id, schoolId: row.school_id, membershipId: row.membership_id, classId: row.class_id, sessionId: row.session_id, status: row.status } as TeacherClassAssignment));
    },
    async readAcademicSources(record) {
      const parameters = scope(record);
      // All source mutations must lock this existing guard FOR UPDATE before
      // touching enrollment, roster, config or scores, then advance its revision.
      const scopes = await connection.unsafe('SELECT revision,academic FROM ' + table('read_scopes') + ' WHERE school_id=$1 AND class_id=$2 AND session_id=$3 AND term_id=$4 FOR SHARE', parameters);
      if (scopes.length !== 1) throw Error('Academic scope unavailable');
      const enrollmentRows = await connection.unsafe('SELECT * FROM ' + table('read_enrollments') + ' WHERE school_id=$1 AND student_id=$2 AND session_id=$3 ORDER BY id FOR SHARE', [record.schoolId, record.studentId, record.sessionId]);
      const subjectRows = await connection.unsafe('SELECT * FROM ' + table('read_subjects') + ' WHERE school_id=$1 AND class_id=$2 AND session_id=$3 AND term_id=$4 ORDER BY subject_id FOR SHARE', parameters);
      const enrollments = enrollmentRows.map(row => ({ id: row.id, schoolId: row.school_id, studentId: row.student_id, classId: row.class_id, sessionId: row.session_id, status: row.status } as TrustedEnrollmentRow));
      const subjects = subjectRows.map(row => {
        if (!Number.isSafeInteger(row.config_revision) || Number(row.config_revision) < 1 || !Number.isSafeInteger(row.source_revision) || Number(row.source_revision) < 1) throw Error('Invalid persisted subject revisions');
        return { schoolId: row.school_id, classId: row.class_id, sessionId: row.session_id, termId: row.term_id, subjectId: row.subject_id, finalized: row.finalized, assessmentRevision: row.assessment_revision,
          sourceVersionKey: JSON.stringify([row.subject_id, row.config_revision, row.source_revision]) } as TrustedSubjectRow;
      });
      return { academic: object(scopes[0].academic) as AcademicReadBundle['academic'], sources: { schoolId: record.schoolId, assessmentRevision: scopes[0].revision as number, enrollments, subjects } };
    },
    async readCurrentRevision(record) {
      const rows = await connection.unsafe('SELECT revision FROM ' + table('read_scopes') + ' WHERE school_id=$1 AND class_id=$2 AND session_id=$3 AND term_id=$4 FOR SHARE', scope(record));
      if (rows.length !== 1) throw Error('Academic scope unavailable');
      return rows[0].revision as number;
    },
  };
}
