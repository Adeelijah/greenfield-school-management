// Candidate trigger protocol for generated fixture schemas only. No DB client.
const q = value => '"' + value.replaceAll('"', '""') + '"';
export function assessmentWriteGuardDDL(schema) {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) throw Error('Only generated disposable fixture schemas allowed.');
 const table = name => q(schema) + '.' + q(name);
 const targets = ['assessment_scores', 'assessment_subject_roster', 'enrollments', 'assessment_config_versions', 'assessment_subjects'];
 const statements = [
  'CREATE TABLE ' + table('fixture_source_write_gate') + ' (id integer PRIMARY KEY CHECK(id=1))',
  'INSERT INTO ' + table('fixture_source_write_gate') + ' VALUES (1)',
  'CREATE TABLE ' + table('fixture_source_write_claims') + ' (transaction_id text NOT NULL,scope_id uuid NOT NULL,PRIMARY KEY(transaction_id,scope_id))',
  `CREATE FUNCTION ${table('fixture_lock_source_write')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 PERFORM id FROM ${table('fixture_source_write_gate')} WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing fixture source gate'; END IF;
 RETURN NULL;
END $$`,
  `CREATE FUNCTION ${table('fixture_mark_source_scope')}(target uuid) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE claimed uuid;
BEGIN
 INSERT INTO ${table('fixture_source_write_claims')}(transaction_id,scope_id)
 VALUES (pg_current_xact_id()::text,target) ON CONFLICT DO NOTHING RETURNING scope_id INTO claimed;
 IF claimed IS NOT NULL THEN
  UPDATE ${table('assessment_scopes')} SET revision=revision+1 WHERE id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing fixture academic scope' USING ERRCODE='23503'; END IF;
 END IF;
END $$`,
  `CREATE FUNCTION ${table('fixture_invalidate_source_rows')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE before_row jsonb; after_row jsonb; target uuid;
BEGIN
 IF TG_TABLE_SCHEMA <> '${schema}' THEN RAISE EXCEPTION 'invalid fixture trigger schema'; END IF;
 before_row := CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 after_row := CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='assessment_scopes' THEN
  PERFORM ${table('fixture_mark_source_scope')}((after_row->>'id')::uuid);
 ELSIF TG_TABLE_NAME='assessment_subject_roster' THEN
  FOR target IN SELECT DISTINCT v.id FROM (VALUES ((before_row->>'scope_id')::uuid),((after_row->>'scope_id')::uuid)) AS v(id) WHERE v.id IS NOT NULL ORDER BY v.id LOOP
   PERFORM ${table('fixture_mark_source_scope')}(target);
  END LOOP;
 ELSIF TG_TABLE_NAME='assessment_scores' THEN
  FOR target IN SELECT DISTINCT r.scope_id FROM ${table('assessment_subject_roster')} r
   WHERE r.id IN ((before_row->>'roster_id')::uuid,(after_row->>'roster_id')::uuid) ORDER BY r.scope_id LOOP
   PERFORM ${table('fixture_mark_source_scope')}(target);
  END LOOP;
 ELSIF TG_TABLE_NAME='enrollments' THEN
  FOR target IN SELECT s.id FROM ${table('assessment_scopes')} s
   WHERE (s.school_id=(before_row->>'school_id')::uuid AND s.class_id=(before_row->>'class_id')::uuid AND s.session_id=(before_row->>'session_id')::uuid)
      OR (s.school_id=(after_row->>'school_id')::uuid AND s.class_id=(after_row->>'class_id')::uuid AND s.session_id=(after_row->>'session_id')::uuid)
   ORDER BY s.id LOOP
   PERFORM ${table('fixture_mark_source_scope')}(target);
  END LOOP;
 ELSIF TG_TABLE_NAME IN ('assessment_config_versions','assessment_subjects') THEN
  FOR target IN SELECT DISTINCT r.scope_id FROM ${table('assessment_subject_roster')} r
   WHERE (TG_TABLE_NAME='assessment_config_versions' AND r.config_version_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid))
      OR (TG_TABLE_NAME='assessment_subjects' AND r.subject_id IN ((before_row->>'id')::uuid,(after_row->>'id')::uuid)) ORDER BY r.scope_id LOOP
   PERFORM ${table('fixture_mark_source_scope')}(target);
  END LOOP;
 ELSE RAISE EXCEPTION 'unsupported fixture source table';
 END IF;
 RETURN NULL;
END $$`,
  `CREATE FUNCTION ${table('fixture_reject_source_truncate')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'fixture source truncate or scope deletion forbidden' USING ERRCODE='P0001'; RETURN NULL; END $$`,
 ];
 for (const name of [...targets, 'assessment_scopes']) {
  statements.push('CREATE TRIGGER fixture_source_gate BEFORE INSERT OR UPDATE OR DELETE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_lock_source_write') + '()');
  statements.push('CREATE TRIGGER fixture_source_no_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_reject_source_truncate') + '()');
 }
 for (const name of targets) statements.push('CREATE TRIGGER fixture_source_invalidate AFTER INSERT OR UPDATE OR DELETE ON ' + table(name) + ' FOR EACH ROW EXECUTE FUNCTION ' + table('fixture_invalidate_source_rows') + '()');
 statements.push('CREATE TRIGGER fixture_new_scope_invalidate AFTER INSERT ON ' + table('assessment_scopes') + ' FOR EACH ROW EXECUTE FUNCTION ' + table('fixture_invalidate_source_rows') + '()');
 statements.push('CREATE TRIGGER fixture_no_scope_delete BEFORE DELETE ON ' + table('assessment_scopes') + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_reject_source_truncate') + '()');
 return { statements, readGate: 'SELECT id FROM ' + table('fixture_source_write_gate') + ' WHERE id=1 FOR SHARE', targets };
}
