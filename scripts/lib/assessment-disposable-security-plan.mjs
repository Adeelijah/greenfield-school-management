// Review-only DDL. No connection, role creation, credentials or production names.
import { fixtureRolePreflightPlan } from './assessment-disposable-role-preflight.mjs';
const q = value => '"' + value.replaceAll('"', '""') + '"';
const base = ['schools','school_users','memberships','academic_sessions','terms','academic_levels','academic_sections','classes','students','enrollments','teacher_class_assignments'];
const assessments = ['assessment_subjects','assessment_config_versions','assessment_scopes','assessment_subject_roster','assessment_teacher_subjects','assessment_scores','assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts'];
const reports = ['report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases'];
export function fixtureSecurityPlan(schema, schoolId) {
 const { roles } = fixtureRolePreflightPlan(schema);
 if (typeof schoolId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(schoolId)) throw Error('A fictional school UUID is required.');
 const table = name => q(schema)+'.'+q(name);
 const roleList = Object.values(roles).map(q).join(',');
 const targets = [...base,...assessments,...reports,'fixture_source_write_gate'];
 const appendOnly = reports.filter(name=>name!=='report_cards');
 const reportUpdates = ['stage','version','submitted_by','approved_by','published_at','return_reason','assessment_source_version_id','assessment_revision'];
 const school = "'"+schoolId+"'::uuid";
 const predicate = name => name==='schools' ? 'id='+school
  : name==='school_users' ? 'EXISTS(SELECT 1 FROM '+table('memberships')+' m WHERE m.user_id='+q(name)+'.id AND m.school_id='+school+')'
  : name==='fixture_source_write_gate' ? 'id=1' : 'school_id='+school;
 const statements = [
  'REVOKE ALL ON SCHEMA '+q(schema)+' FROM PUBLIC,'+roleList,
  'REVOKE ALL ON ALL TABLES IN SCHEMA '+q(schema)+' FROM PUBLIC,'+roleList,
  'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA '+q(schema)+' FROM PUBLIC,'+roleList,
  'REVOKE ALL ON ALL SEQUENCES IN SCHEMA '+q(schema)+' FROM PUBLIC,'+roleList,
  'GRANT USAGE ON SCHEMA '+q(schema)+' TO '+roleList,
  `CREATE FUNCTION ${table('fixture_restrict_service_writes')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_user='${roles.reader}' THEN
  RAISE EXCEPTION 'fixture reader cannot mutate rows' USING ERRCODE='42501';
 ELSIF current_user='${roles.writer}' THEN
  IF TG_TABLE_NAME='report_cards' AND TG_OP IN ('INSERT','UPDATE') THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME IN ('report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases') AND TG_OP='INSERT' THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'fixture writer cannot mutate academic or immutable rows' USING ERRCODE='42501';
 END IF;
 RETURN NULL;
END $$`,
  'REVOKE ALL ON FUNCTION '+table('fixture_restrict_service_writes')+'() FROM PUBLIC,'+roleList,
 ];
 for (const name of targets) {
  const target=table(name), scope=predicate(name);
  statements.push('ALTER TABLE '+target+' ENABLE ROW LEVEL SECURITY', 'ALTER TABLE '+target+' FORCE ROW LEVEL SECURITY');
  // Explicit setup-owner policy keeps fixture administration separate from tested roles.
  statements.push('CREATE POLICY fixture_setup_owner ON '+target+' FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)');
  // Restrictive clamp also bounds any additional permissive policies for these roles.
  statements.push('CREATE POLICY fixture_service_school ON '+target+' AS RESTRICTIVE FOR ALL TO '+roleList+' USING ('+scope+') WITH CHECK ('+scope+')');
  statements.push('CREATE POLICY fixture_service_read ON '+target+' FOR SELECT TO '+roleList+' USING ('+scope+')');
  // Locking SELECT needs UPDATE privilege and UPDATE USING visibility. No row is modified.
  statements.push('CREATE POLICY fixture_service_lock ON '+target+' FOR UPDATE TO '+roleList+' USING ('+scope+') WITH CHECK (false)');
  statements.push('GRANT SELECT ON '+target+' TO '+roleList);
  statements.push('GRANT UPDATE (id) ON '+target+' TO '+q(roles.reader));
  if(name!=='report_cards') statements.push('GRANT UPDATE (id) ON '+target+' TO '+q(roles.writer));
  statements.push('CREATE TRIGGER aaa_fixture_service_write_guard BEFORE INSERT OR UPDATE OR DELETE ON '+target+' FOR EACH STATEMENT EXECUTE FUNCTION '+table('fixture_restrict_service_writes')+'()');
 }
 for(const name of reports) {
  statements.push('GRANT INSERT ON '+table(name)+' TO '+q(roles.writer));
  statements.push('CREATE POLICY fixture_report_insert ON '+table(name)+' FOR INSERT TO '+q(roles.writer)+' WITH CHECK (school_id='+school+')');
 }
 statements.push('GRANT UPDATE ('+reportUpdates.map(q).join(',')+') ON '+table('report_cards')+' TO '+q(roles.writer));
 statements.push('CREATE POLICY fixture_report_transition ON '+table('report_cards')+' FOR UPDATE TO '+q(roles.writer)+' USING (school_id='+school+') WITH CHECK (school_id='+school+')');
 return { roles, targets, appendOnly, reportUpdates, statements };
}
