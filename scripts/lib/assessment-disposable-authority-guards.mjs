// Fixture-only lock ordering. Requires assessmentWriteGuardDDL installed first.
export function assessmentAuthorityGuardDDL(schema) {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only generated disposable fixture schemas allowed.');
 const table = name => '"' + schema + '"."' + name + '"';
 const targets = ['schools', 'school_users', 'memberships', 'teacher_class_assignments', 'assessment_teacher_subjects', 'students', 'classes', 'academic_levels', 'academic_sections', 'academic_sessions', 'terms'];
 const statements = targets.flatMap(name => [
  'CREATE TRIGGER fixture_authority_gate BEFORE INSERT OR UPDATE OR DELETE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_lock_source_write') + '()',
  'CREATE TRIGGER fixture_authority_no_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_reject_source_truncate') + '()',
 ]);
 const academicParents = ['schools', 'students', 'classes', 'academic_levels', 'academic_sections', 'academic_sessions', 'terms'];
 statements.push(`CREATE FUNCTION ${table('fixture_invalidate_parent_rows')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; target uuid;
BEGIN
 IF TG_TABLE_SCHEMA <> '${schema}' THEN RAISE EXCEPTION 'invalid fixture parent schema'; END IF;
 before_row := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 after_row := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 FOR target IN
  SELECT s.id FROM ${table('assessment_scopes')} s
  WHERE (TG_TABLE_NAME='schools' AND s.school_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='classes' AND s.class_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='academic_sessions' AND s.session_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='terms' AND s.term_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
   OR (TG_TABLE_NAME='students' AND EXISTS (
    SELECT 1 FROM ${table('enrollments')} e WHERE e.school_id=s.school_id AND e.class_id=s.class_id AND e.session_id=s.session_id
     AND e.student_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)))
   OR (TG_TABLE_NAME IN ('academic_levels','academic_sections') AND EXISTS (
    SELECT 1 FROM ${table('classes')} c WHERE c.school_id=s.school_id AND c.id=s.class_id
     AND ((TG_TABLE_NAME='academic_levels' AND c.level_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
       OR (TG_TABLE_NAME='academic_sections' AND c.section_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)))))
  ORDER BY s.id
 LOOP
  PERFORM ${table('fixture_mark_source_scope')}(target);
 END LOOP;
 RETURN NULL;
END $$`);
 // BEFORE ROW retains parent/enrollment discovery before a cascading delete.
 // INSERT has no dependent scope yet; later scope/enrollment creation already invalidates.
 for (const name of academicParents) statements.push('CREATE TRIGGER fixture_parent_invalidate BEFORE UPDATE OR DELETE ON ' + table(name) + ' FOR EACH ROW EXECUTE FUNCTION ' + table('fixture_invalidate_parent_rows') + '()');
 return { targets, academicParents, statements };
}
