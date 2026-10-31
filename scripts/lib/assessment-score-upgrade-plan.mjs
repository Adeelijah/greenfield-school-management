// Generated upgraded fixture only. Never emits an installer for public.
import {upgradeFixtureSchema} from './report-card-upgrade-plan.mjs';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function assessmentScoreUpgradePlan(schema,binding){
 const q=upgradeFixtureSchema(schema),t=name=>q+'."'+name+'"';
 const keys=['schoolId','primary5ClassId','crecheClassId','sessionId','termId'];
 if(!binding||Object.keys(binding).length!==5||!keys.every(k=>uuid(binding[k]))||Object.keys(binding).some(k=>!keys.includes(k))||new Set(Object.values(binding)).size!==5)throw Error('Exact fictional assessment scope bindings required');
 const roles={owner:schema+'_score_owner',runtime:schema+'_score_runtime',login:schema+'_score_login'};
 const read=['schools','school_users','memberships','classes','academic_levels','academic_sections','academic_sessions','terms','students','enrollments','teacher_class_assignments','assessment_subjects','assessment_config_versions','assessment_scopes','assessment_subject_roster','assessment_teacher_subjects','assessment_scores','assessment_audit','assessment_operation_receipts'];
 const fn=`CREATE FUNCTION ${t('save_subject_scores')}(verified_auth uuid,cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET row_security=on AS $scores$
DECLARE actor record; sc record; roster record; cfg record; klass record; prior record; old_score record; cell jsonb; component jsonb; canonical jsonb; fingerprint text; result jsonb; before_scores jsonb; audit_id uuid; pupil_count integer; after_revision integer; has_old boolean;
BEGIN
 PERFORM id FROM ${t('fixture_source_write_gate')} WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing coordinated assessment source gate'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1',0));
 IF cmd IS NULL OR jsonb_typeof(cmd)<>'object' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>10 OR NOT (cmd ?& ARRAY['action','classKey','rosterId','configVersionId','expectedConfigRevision','expectedRosterVersion','expectedScopeRevision','operationKey','reason','scores']) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF cmd->>'action'<>'save_subject_scores' OR jsonb_typeof(cmd->'action')<>'string' OR jsonb_typeof(cmd->'classKey')<>'string' OR cmd->>'classKey' NOT IN ('primary5','creche') OR jsonb_typeof(cmd->'rosterId')<>'string' OR jsonb_typeof(cmd->'configVersionId')<>'string' OR cmd->>'rosterId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR cmd->>'configVersionId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(cmd->'operationKey')<>'string' OR cmd->>'operationKey' !~ '^[A-Za-z0-9:_-]{8,120}$' OR jsonb_typeof(cmd->'scores')<>'array' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF jsonb_array_length(cmd->'scores') NOT BETWEEN 1 AND 10000 OR (cmd->'reason'<>'null'::jsonb AND (jsonb_typeof(cmd->'reason')<>'string' OR length(btrim(cmd->>'reason')) NOT BETWEEN 1 AND 2000)) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['expectedConfigRevision','expectedRosterVersion','expectedScopeRevision']) k WHERE jsonb_typeof(cmd->k)<>'number' OR cmd->>k !~ '^[1-9][0-9]{0,9}$') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['expectedConfigRevision','expectedRosterVersion','expectedScopeRevision']) k WHERE (cmd->>k)::numeric>=2147483647) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 FOR cell IN SELECT value FROM jsonb_array_elements(cmd->'scores') LOOP
  IF jsonb_typeof(cell)<>'object' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(cell))<>6 OR NOT (cell ?& ARRAY['studentId','enrollmentId','componentKey','expectedVersion','numericScore','observationKey']) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF jsonb_typeof(cell->'studentId')<>'string' OR cell->>'studentId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(cell->'enrollmentId')<>'string' OR cell->>'enrollmentId' !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(cell->'componentKey')<>'string' OR length(cell->>'componentKey') NOT BETWEEN 1 AND 128 OR btrim(cell->>'componentKey')<>cell->>'componentKey' OR jsonb_typeof(cell->'expectedVersion')<>'number' OR cell->>'expectedVersion' !~ '^(0|[1-9][0-9]{0,9})$' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF (cell->>'expectedVersion')::numeric>=2147483647 OR (cell->'numericScore'<>'null'::jsonb AND (jsonb_typeof(cell->'numericScore')<>'string' OR cell->>'numericScore' !~ '^(0|[1-9][0-9]{0,7})(\\.[0-9]{1,4})?$')) OR (cell->'observationKey'<>'null'::jsonb AND (jsonb_typeof(cell->'observationKey')<>'string' OR length(cell->>'observationKey') NOT BETWEEN 1 AND 128 OR btrim(cell->>'observationKey')<>cell->>'observationKey')) OR (cell->'numericScore'<>'null'::jsonb AND cell->'observationKey'<>'null'::jsonb) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 END LOOP;
 IF (SELECT count(DISTINCT (s->>'enrollmentId',s->>'componentKey')) FROM jsonb_array_elements(cmd->'scores') s)<>jsonb_array_length(cmd->'scores') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF (SELECT count(*) FROM ${t('school_users')} WHERE auth_user_id=verified_auth)<>1 OR (SELECT count(*) FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active')<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT m.* INTO actor FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active';
 IF actor.school_id<>'${binding.schoolId}'::uuid OR actor.role NOT IN ('admin','teacher') THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT c.*,l.stage,l.primary_year INTO klass FROM ${t('classes')} c JOIN ${t('academic_levels')} l ON l.school_id=c.school_id AND l.id=c.level_id AND l.is_active JOIN ${t('academic_sections')} s ON s.school_id=c.school_id AND s.id=c.section_id AND s.level_id=l.id AND s.is_active JOIN ${t('schools')} school ON school.id=c.school_id AND school.final_primary_year=5 WHERE c.school_id=actor.school_id AND ((cmd->>'classKey'='primary5' AND c.id='${binding.primary5ClassId}'::uuid AND l.stage='primary' AND l.primary_year=5) OR (cmd->>'classKey'='creche' AND c.id='${binding.crecheClassId}'::uuid AND l.stage='creche'));
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT s.* INTO sc FROM ${t('assessment_scopes')} s JOIN ${t('academic_sessions')} y ON y.school_id=s.school_id AND y.id=s.session_id AND y.is_current JOIN ${t('terms')} term ON term.school_id=s.school_id AND term.id=s.term_id AND term.session_id=y.id AND term.is_current WHERE s.school_id=actor.school_id AND s.class_id=klass.id AND s.session_id='${binding.sessionId}'::uuid AND s.term_id='${binding.termId}'::uuid FOR UPDATE OF s;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 SELECT r.* INTO roster FROM ${t('assessment_subject_roster')} r JOIN ${t('assessment_subjects')} subject ON subject.school_id=r.school_id AND subject.id=r.subject_id AND subject.is_active WHERE r.school_id=actor.school_id AND r.scope_id=sc.id AND r.id=(cmd->>'rosterId')::uuid AND r.is_active;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 IF actor.role='teacher' AND (SELECT count(*) FROM ${t('teacher_class_assignments')} WHERE school_id=actor.school_id AND teacher_membership_id=actor.id AND class_id=klass.id AND session_id=sc.session_id AND ended_at IS NULL)<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 IF actor.role='teacher' AND (SELECT count(*) FROM ${t('teacher_class_assignments')} a JOIN ${t('assessment_teacher_subjects')} link ON link.school_id=a.school_id AND link.class_assignment_id=a.id AND link.roster_id=roster.id AND link.is_active WHERE a.school_id=actor.school_id AND a.teacher_membership_id=actor.id AND a.class_id=klass.id AND a.session_id=sc.session_id AND a.ended_at IS NULL)<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 canonical:=cmd || jsonb_build_object('reason',CASE WHEN cmd->'reason'='null'::jsonb THEN NULL ELSE btrim(cmd->>'reason') END,'scores',(SELECT jsonb_agg(s ORDER BY s->>'enrollmentId',s->>'componentKey') FROM jsonb_array_elements(cmd->'scores') s));
 fingerprint:=encode(sha256(convert_to(canonical::text,'UTF8')),'hex');
 SELECT * INTO prior FROM ${t('assessment_operation_receipts')} WHERE school_id=actor.school_id AND actor_membership_id=actor.id AND operation_key=cmd->>'operationKey';
 IF FOUND THEN IF prior.scope_id=sc.id AND prior.fingerprint=fingerprint AND prior.outcome->>'format'='greenfield.assessment.score-save.v1' THEN RETURN (prior.outcome->'result') || '{"kind":"replay"}'::jsonb; ELSE RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF; END IF;
 IF cmd->'reason'='null'::jsonb AND EXISTS(SELECT 1 FROM ${t('assessment_operation_receipts')} WHERE school_id=actor.school_id AND scope_id=sc.id AND outcome->>'format'='greenfield.assessment.score-save.v1' AND outcome#>>'{request,rosterId}'=roster.id::text) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF sc.revision<>(cmd->>'expectedScopeRevision')::integer OR sc.revision>=2147483647 OR roster.roster_version<>(cmd->>'expectedRosterVersion')::integer OR roster.config_version_id<>(cmd->>'configVersionId')::uuid OR EXISTS(SELECT 1 FROM ${t('fixture_source_write_claims')} WHERE transaction_id=pg_current_xact_id()::text AND scope_id=sc.id) THEN RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF;
 SELECT * INTO cfg FROM ${t('assessment_config_versions')} WHERE school_id=actor.school_id AND id=roster.config_version_id AND level_id=klass.level_id AND session_id=sc.session_id AND term_id=sc.term_id AND (subject_id IS NULL OR subject_id=roster.subject_id) AND state='finalized' AND revision=(cmd->>'expectedConfigRevision')::integer;
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF;
 IF (klass.stage='primary')<>(cfg.mode='numeric') OR cfg.grading->>'mode' IS DISTINCT FROM cfg.mode::text OR jsonb_typeof(cfg.components)<>'array' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF jsonb_array_length(cfg.components) NOT BETWEEN 1 AND 64 OR (SELECT count(DISTINCT c->>'id') FROM jsonb_array_elements(cfg.components) c)<>jsonb_array_length(cfg.components) OR EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.components) c WHERE jsonb_typeof(c->'id') IS DISTINCT FROM 'string' OR length(c->>'id') NOT BETWEEN 1 AND 128 OR btrim(c->>'id')<>c->>'id' OR jsonb_typeof(c->'label') IS DISTINCT FROM 'string' OR btrim(c->>'label')='' OR jsonb_typeof(c->'category') IS DISTINCT FROM 'string' OR c->>'category' NOT IN ('ca','exam','other') OR jsonb_typeof(c->'required') IS DISTINCT FROM 'boolean' OR jsonb_typeof(c->'maximumScore') IS DISTINCT FROM 'number' OR jsonb_typeof(c->'weight') IS DISTINCT FROM 'number' OR c->>'maximumScore' !~ '^(0|[1-9][0-9]{0,7})(\\.[0-9]{1,4})?$' OR c->>'weight' !~ '^(0|[1-9][0-9]{0,7})(\\.[0-9]{1,4})?$') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.components) c WHERE (c->>'maximumScore')::numeric<=0 OR (c->>'weight')::numeric<=0) OR (SELECT sum((c->>'weight')::numeric) FROM jsonb_array_elements(cfg.components) c)<>100 THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF cfg.mode='numeric' THEN
  IF jsonb_typeof(cfg.grading->'bands') IS DISTINCT FROM 'array' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF jsonb_array_length(cfg.grading->'bands')<1 OR EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.grading->'bands') b WHERE jsonb_typeof(b->'min') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'max') IS DISTINCT FROM 'number' OR jsonb_typeof(b->'label') IS DISTINCT FROM 'string' OR btrim(b->>'label')='') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM (SELECT (b->>'min')::numeric AS lo,(b->>'max')::numeric AS hi,lag((b->>'max')::numeric) OVER(ORDER BY (b->>'min')::numeric) AS previous,row_number() OVER(ORDER BY (b->>'min')::numeric) AS band_number,count(*) OVER() AS band_count FROM jsonb_array_elements(cfg.grading->'bands') b) bands WHERE lo<0 OR hi>100 OR lo>=hi OR (band_number=1 AND lo<>0) OR (band_number=band_count AND hi<>100) OR (band_number>1 AND previous<>lo)) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 END IF;
 IF cfg.mode='observational' THEN
  IF jsonb_typeof(cfg.grading->'levels') IS DISTINCT FROM 'array' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF jsonb_array_length(cfg.grading->'levels')<2 OR EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.grading->'levels') l WHERE jsonb_typeof(l->'id') IS DISTINCT FROM 'string' OR length(btrim(l->>'id')) NOT BETWEEN 1 AND 128 OR jsonb_typeof(l->'label') IS DISTINCT FROM 'string' OR btrim(l->>'label')='') OR (SELECT count(DISTINCT l->>'id') FROM jsonb_array_elements(cfg.grading->'levels') l)<>jsonb_array_length(cfg.grading->'levels') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 END IF;
 SELECT count(*) INTO pupil_count FROM ${t('enrollments')} e JOIN ${t('students')} p ON p.school_id=e.school_id AND p.id=e.student_id AND p.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sc.session_id AND e.status='active';
 IF pupil_count=0 OR pupil_count*jsonb_array_length(cfg.components)<>jsonb_array_length(cmd->'scores') OR EXISTS(SELECT 1 FROM ${t('enrollments')} e JOIN ${t('students')} p ON p.school_id=e.school_id AND p.id=e.student_id AND p.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sc.session_id AND e.status='active' AND (SELECT count(*) FROM ${t('enrollments')} other WHERE other.school_id=e.school_id AND other.student_id=e.student_id AND other.session_id=e.session_id AND other.status='active')<>1) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF EXISTS(SELECT 1 FROM ${t('assessment_scores')} score WHERE score.school_id=actor.school_id AND score.roster_id=roster.id AND score.student_id IN (SELECT student_id FROM ${t('enrollments')} WHERE school_id=actor.school_id AND class_id=klass.id AND session_id=sc.session_id AND status='active') AND (score.config_version_id<>cfg.id OR NOT EXISTS(SELECT 1 FROM ${t('enrollments')} e WHERE e.school_id=score.school_id AND e.id=score.enrollment_id AND e.student_id=score.student_id AND e.class_id=klass.id AND e.session_id=sc.session_id AND e.status='active') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.components) c WHERE c->>'id'=score.component_key))) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 -- Validate every cell/version before the first mutation; the exclusive gate prevents phantoms.
 FOR cell IN SELECT value FROM jsonb_array_elements(cmd->'scores') LOOP
  IF NOT EXISTS(SELECT 1 FROM ${t('enrollments')} e JOIN ${t('students')} p ON p.school_id=e.school_id AND p.id=e.student_id AND p.status='active' WHERE e.school_id=actor.school_id AND e.id=(cell->>'enrollmentId')::uuid AND e.student_id=(cell->>'studentId')::uuid AND e.class_id=klass.id AND e.session_id=sc.session_id AND e.status='active') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  SELECT c INTO component FROM jsonb_array_elements(cfg.components) c WHERE c->>'id'=cell->>'componentKey';
  IF NOT FOUND THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  IF cell->'numericScore'='null'::jsonb AND cell->'observationKey'='null'::jsonb THEN IF (component->>'required')::boolean THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  ELSIF cfg.mode='numeric' THEN IF cell->'numericScore'='null'::jsonb OR cell->'observationKey'<>'null'::jsonb OR (cell->>'numericScore')::numeric>(component->>'maximumScore')::numeric THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
  ELSE IF cell->'numericScore'<>'null'::jsonb OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(cfg.grading->'levels') l WHERE l->>'id'=cell->>'observationKey') THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF; END IF;
  SELECT * INTO old_score FROM ${t('assessment_scores')} WHERE school_id=actor.school_id AND roster_id=roster.id AND enrollment_id=(cell->>'enrollmentId')::uuid AND component_key=cell->>'componentKey' FOR UPDATE;
  has_old:=FOUND;
  IF (has_old AND (old_score.version<>(cell->>'expectedVersion')::integer OR old_score.student_id<>(cell->>'studentId')::uuid OR old_score.config_version_id<>cfg.id)) OR (NOT has_old AND (cell->>'expectedVersion')::integer<>0) THEN RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF;
  IF has_old AND cmd->'reason'='null'::jsonb THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 END LOOP;
 SELECT COALESCE(jsonb_agg(to_jsonb(s)||jsonb_build_object('numeric_score',s.numeric_score::text) ORDER BY s.id),'[]'::jsonb) INTO before_scores FROM ${t('assessment_scores')} s WHERE s.school_id=actor.school_id AND s.roster_id=roster.id;
 FOR cell IN SELECT value FROM jsonb_array_elements(canonical->'scores') LOOP
  IF cell->'numericScore'='null'::jsonb AND cell->'observationKey'='null'::jsonb THEN
   DELETE FROM ${t('assessment_scores')} WHERE school_id=actor.school_id AND roster_id=roster.id AND enrollment_id=(cell->>'enrollmentId')::uuid AND component_key=cell->>'componentKey';
  ELSIF (cell->>'expectedVersion')::integer=0 THEN
   INSERT INTO ${t('assessment_scores')}(school_id,roster_id,config_version_id,enrollment_id,student_id,component_key,numeric_score,observation_key,version,updated_by) VALUES(actor.school_id,roster.id,cfg.id,(cell->>'enrollmentId')::uuid,(cell->>'studentId')::uuid,cell->>'componentKey',(cell->>'numericScore')::numeric,cell->>'observationKey',1,actor.id);
  ELSE
   UPDATE ${t('assessment_scores')} SET numeric_score=(cell->>'numericScore')::numeric,observation_key=cell->>'observationKey',version=version+1,updated_by=actor.id WHERE school_id=actor.school_id AND roster_id=roster.id AND enrollment_id=(cell->>'enrollmentId')::uuid AND component_key=cell->>'componentKey' AND version=(cell->>'expectedVersion')::integer;
   IF NOT FOUND THEN RAISE EXCEPTION 'Locked score version changed'; END IF;
  END IF;
 END LOOP;
 PERFORM ${t('fixture_mark_source_scope')}(sc.id);
 SELECT revision INTO after_revision FROM ${t('assessment_scopes')} WHERE id=sc.id AND school_id=actor.school_id;
 IF after_revision IS DISTINCT FROM sc.revision+1 THEN RAISE EXCEPTION 'Assessment save must invalidate its scope exactly once'; END IF;
 audit_id:=gen_random_uuid();
 INSERT INTO ${t('assessment_audit')}(id,school_id,scope_id,actor_membership_id,action,before_revision,after_revision) VALUES(audit_id,actor.school_id,sc.id,actor.id,'save_subject_scores',sc.revision,after_revision);
 result:=jsonb_build_object('ok',true,'kind','applied','revision',after_revision);
 INSERT INTO ${t('assessment_operation_receipts')}(school_id,scope_id,actor_membership_id,operation_key,fingerprint,resulting_revision,outcome) VALUES(actor.school_id,sc.id,actor.id,cmd->>'operationKey',fingerprint,after_revision,jsonb_build_object('format','greenfield.assessment.score-save.v1','auditId',audit_id,'request',canonical,'beforeScores',before_scores,'result',result));
 RETURN result;
END $scores$`;
 const preflight=`DO $score_preflight$ BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relname IN (${[...read,'fixture_source_write_gate'].map(n=>"'"+n+"'").join(',')}) AND c.relrowsecurity AND c.relforcerowsecurity)<>${read.length+1} THEN RAISE EXCEPTION 'Forced schema-faithful score foundation required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND NOT p.polpermissive AND 0::oid=ANY(p.polroles)) THEN RAISE EXCEPTION 'PUBLIC restrictive policy requires separate authority review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN ('${roles.owner}','${roles.runtime}','${roles.login}')) OR to_regprocedure('${schema}.save_subject_scores(uuid,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Score roles and entry must be absent'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_trigger tr JOIN pg_catalog.pg_class c ON c.oid=tr.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relname IN ('assessment_audit','assessment_operation_receipts') AND tr.tgname IN ('fixture_upgrade_history_write','fixture_upgrade_history_truncate') AND NOT tr.tgisinternal AND tr.tgenabled='O')<>4 THEN RAISE EXCEPTION 'Installed immutable assessment history guards required'; END IF;
 IF to_regclass('${schema}.fixture_source_write_claims') IS NULL OR to_regprocedure('${schema}.fixture_mark_source_scope(uuid)') IS NULL OR NOT EXISTS(SELECT 1 FROM ${t('fixture_source_write_gate')} WHERE id=1) THEN RAISE EXCEPTION 'Installed coordinated revision protocol required'; END IF;
 END $score_preflight$`;
 const statements=[
  preflight,
  ...['owner','runtime'].map(k=>'CREATE ROLE "'+roles[k]+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION'),
  'GRANT USAGE ON SCHEMA '+q+' TO "'+roles.owner+'","'+roles.runtime+'"',
  ...read.flatMap(name=>['GRANT SELECT ON '+t(name)+' TO "'+roles.owner+'"','CREATE POLICY score_private_read ON '+t(name)+' FOR SELECT TO "'+roles.owner+'" USING(true)']),
  ...['assessment_scores','assessment_scopes','assessment_audit','assessment_operation_receipts'].map(name=>'CREATE POLICY score_private_write ON '+t(name)+' FOR ALL TO "'+roles.owner+'" USING(school_id=\''+binding.schoolId+'\'::uuid) WITH CHECK(school_id=\''+binding.schoolId+'\'::uuid)'),
  'GRANT INSERT,DELETE ON '+t('assessment_scores')+' TO "'+roles.owner+'"',
  'GRANT UPDATE(numeric_score,observation_key,version,updated_by) ON '+t('assessment_scores')+' TO "'+roles.owner+'"',
  'GRANT UPDATE(revision) ON '+t('assessment_scopes')+' TO "'+roles.owner+'"',
  'GRANT INSERT ON '+t('assessment_audit')+','+t('assessment_operation_receipts')+' TO "'+roles.owner+'"',
  'GRANT SELECT,INSERT ON '+t('fixture_source_write_claims')+' TO "'+roles.owner+'"',
  'ALTER TABLE '+t('fixture_source_write_claims')+' ENABLE ROW LEVEL SECURITY','ALTER TABLE '+t('fixture_source_write_claims')+' FORCE ROW LEVEL SECURITY',
  'CREATE POLICY score_private_claims ON '+t('fixture_source_write_claims')+' TO "'+roles.owner+'" USING(true) WITH CHECK(true)',
  'GRANT SELECT,UPDATE(id) ON '+t('fixture_source_write_gate')+' TO "'+roles.owner+'"',
  'CREATE POLICY score_private_gate ON '+t('fixture_source_write_gate')+' TO "'+roles.owner+'" USING(id=1) WITH CHECK(false)',
  ...['fixture_lock_source_write()','fixture_mark_source_scope(uuid)','fixture_invalidate_source_rows()'].map(sig=>'GRANT EXECUTE ON FUNCTION '+t(sig.split('(')[0])+'('+sig.split('(')[1]+' TO "'+roles.owner+'"'),
  fn,'REVOKE ALL ON FUNCTION '+t('save_subject_scores')+'(uuid,jsonb) FROM PUBLIC',
  'GRANT CREATE ON SCHEMA '+q+' TO "'+roles.owner+'"','ALTER FUNCTION '+t('save_subject_scores')+'(uuid,jsonb) OWNER TO "'+roles.owner+'"','REVOKE CREATE ON SCHEMA '+q+' FROM "'+roles.owner+'"',
  'GRANT EXECUTE ON FUNCTION '+t('save_subject_scores')+'(uuid,jsonb) TO "'+roles.runtime+'"',
 ];
 return{schema,roles,read,statements,sql:fn};
}
