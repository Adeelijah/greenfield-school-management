// Fixture-only lock ordering. Requires assessmentWriteGuardDDL installed first.
export function assessmentAuthorityGuardDDL(schema) {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only generated disposable fixture schemas allowed.');
 const table = name => '"' + schema + '"."' + name + '"';
 const targets = ['schools', 'school_users', 'memberships', 'teacher_class_assignments', 'assessment_teacher_subjects', 'students', 'classes', 'academic_levels', 'academic_sections', 'academic_sessions', 'terms'];
 const statements = targets.flatMap(name => [
  'CREATE TRIGGER fixture_authority_gate BEFORE INSERT OR UPDATE OR DELETE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_lock_source_write') + '()',
  'CREATE TRIGGER fixture_authority_no_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_reject_source_truncate') + '()',
 ]);
 return { targets, statements };
}
