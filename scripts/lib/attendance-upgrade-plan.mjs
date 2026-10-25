// Additive attendance candidate for a generated, schema-faithful upgrade only.
// Never emits public SQL, creates base tables or changes existing report roles.
import {attendanceFixturePlan} from './attendance-disposable-plan.mjs';
import {upgradeFixtureSchema} from './report-card-upgrade-plan.mjs';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
function once(source,before,after){if(source.split(before).length!==2)throw Error('Reviewed attendance source no longer matches adaptation');return source.replace(before,after);}
export function attendanceUpgradePlan(schema,binding){
 const q=upgradeFixtureSchema(schema);
 if(!binding||Object.keys(binding).length!==3||Object.keys(binding).some(k=>!['schoolId','primary5ClassId','crecheClassId'].includes(k))||!['schoolId','primary5ClassId','crecheClassId'].every(k=>uuid(binding[k]))||new Set(Object.values(binding)).size!==3)throw Error('Exact fictional school and class bindings required');
 const roles={owner:schema+'_attendance_owner',worker:schema+'_attendance_worker',login:schema+'_attendance_login'};
 const origin='at_it_'+schema.slice('rc_it_'.length),candidate=attendanceFixturePlan(origin),t=name=>q+'."'+name+'"';
 const adapt=sql=>sql.replaceAll('"'+origin+'"',q).replaceAll(origin+'_owner',roles.owner).replaceAll(origin+'_worker',roles.worker).replaceAll('"authority_gate"','"fixture_source_write_gate"');
 const structurePredicate=" AND ((c.id='"+binding.primary5ClassId+"'::uuid AND l.stage='primary' AND l.primary_year=5) OR (c.id='"+binding.crecheClassId+"'::uuid AND l.stage='creche'))";
 const classCase=expression=>`CASE ${expression} WHEN 'primary5' THEN '${binding.primary5ClassId}'::uuid WHEN 'creche' THEN '${binding.crecheClassId}'::uuid END`;
 let save=adapt(candidate.functions[2]);
 save=once(save,"SELECT * INTO klass FROM "+t('classes')+" WHERE school_id=actor.school_id AND class_key=cmd->>'classKey';", "SELECT c.* INTO klass FROM "+t('classes')+" c JOIN "+t('academic_levels')+" l ON l.school_id=c.school_id AND l.id=c.level_id JOIN "+t('academic_sections')+" s ON s.school_id=c.school_id AND s.id=c.section_id AND s.level_id=l.id WHERE c.school_id=actor.school_id AND l.is_active AND s.is_active"+structurePredicate+" AND c.id="+classCase("cmd->>'classKey'")+";");
 save=once(save,"IF actor.role NOT IN ('admin','teacher')",`IF actor.school_id<>'${binding.schoolId}'::uuid OR actor.role NOT IN ('admin','teacher')`);
 const read=`CREATE FUNCTION ${t('read_attendance')}(verified_auth uuid, class_key text, selected_date date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE actor record; klass record; sess record; reg record; marks jsonb; history jsonb;
BEGIN
 PERFORM id FROM ${t('fixture_source_write_gate')} WHERE id=1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing coordinated source gate'; END IF;
 IF class_key IS NULL OR class_key NOT IN ('primary5','creche') OR selected_date IS NULL THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF (SELECT count(*) FROM ${t('school_users')} WHERE auth_user_id=verified_auth)<>1 OR (SELECT count(*) FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active')<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT m.* INTO actor FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active';
 IF actor.school_id<>'${binding.schoolId}'::uuid OR actor.role NOT IN ('admin','teacher') THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT c.* INTO klass FROM ${t('classes')} c JOIN ${t('academic_levels')} l ON l.school_id=c.school_id AND l.id=c.level_id JOIN ${t('academic_sections')} s ON s.school_id=c.school_id AND s.id=c.section_id AND s.level_id=l.id WHERE c.school_id=actor.school_id AND l.is_active AND s.is_active${structurePredicate} AND c.id=${classCase('class_key')};
 IF NOT FOUND OR (SELECT count(*) FROM ${t('academic_sessions')} WHERE school_id=actor.school_id AND is_current)<>1 THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 SELECT * INTO sess FROM ${t('academic_sessions')} WHERE school_id=actor.school_id AND is_current;
 IF selected_date NOT BETWEEN sess.starts_on AND sess.ends_on OR selected_date>(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF actor.role='teacher' AND (SELECT count(*) FROM ${t('teacher_class_assignments')} WHERE school_id=actor.school_id AND teacher_membership_id=actor.id AND class_id=klass.id AND session_id=sess.id AND ended_at IS NULL)<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT * INTO reg FROM ${t('attendance_registers')} WHERE school_id=actor.school_id AND class_id=klass.id AND session_id=sess.id AND register_date=selected_date FOR SHARE;
 IF NOT FOUND THEN RETURN '{"ok":true,"register":null}'::jsonb; END IF;
 SELECT jsonb_object_agg(student_id::text,status) INTO marks FROM ${t('attendance_marks')} WHERE school_id=actor.school_id AND register_id=reg.id;
 SELECT jsonb_agg(jsonb_build_object('version',version,'reason',reason,'marks',a.marks,'recordedAt',to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY version) INTO history FROM ${t('attendance_audit')} a WHERE school_id=actor.school_id AND register_id=reg.id;
 RETURN jsonb_build_object('ok',true,'register',jsonb_build_object('version',reg.version,'date',reg.register_date::text,'marks',marks,'history',history));
END $f$`;
 const foundation=['schools','school_users','memberships','classes','academic_levels','academic_sections','academic_sessions','students','enrollments','teacher_class_assignments'];
 const attendance=['attendance_registers','attendance_marks','attendance_audit','attendance_receipts'];
 const preflight=`DO $p$ BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relname IN (${[...foundation,'fixture_source_write_gate'].map(name=>"'"+name+"'").join(',')}) AND c.relrowsecurity AND c.relforcerowsecurity)<>11 THEN RAISE EXCEPTION 'Forced foundation RLS required'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND NOT p.polpermissive AND 0::oid=ANY(p.polroles)) THEN RAISE EXCEPTION 'PUBLIC restrictive policy requires separate complete-authority review'; END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relname IN ('attendance_registers','attendance_marks','attendance_audit','attendance_receipts')) THEN RAISE EXCEPTION 'Attendance extension must be absent'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ${t('schools')} WHERE id='${binding.schoolId}'::uuid AND final_primary_year=5) THEN RAISE EXCEPTION 'Reviewed Primary 5 school required'; END IF;
 IF (SELECT count(*) FROM ${t('classes')} c JOIN ${t('academic_levels')} l ON l.school_id=c.school_id AND l.id=c.level_id JOIN ${t('academic_sections')} s ON s.school_id=c.school_id AND s.id=c.section_id AND s.level_id=l.id WHERE c.school_id='${binding.schoolId}'::uuid AND l.is_active AND s.is_active AND ((c.id='${binding.primary5ClassId}'::uuid AND l.stage='primary' AND l.primary_year=5) OR (c.id='${binding.crecheClassId}'::uuid AND l.stage='creche')))<>2 THEN RAISE EXCEPTION 'Class mapping differs from reviewed structure'; END IF;
 IF NOT EXISTS(SELECT 1 FROM ${t('fixture_source_write_gate')} WHERE id=1) THEN RAISE EXCEPTION 'Coordinated source gate required'; END IF;
 END $p$`;
 const statements=[
  preflight,
  ...Object.entries(roles).filter(([key])=>key!=='login').map(([,role])=>'CREATE ROLE "'+role+'" NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION'),
  ...candidate.tables.map(adapt),
  // Foundation composite keys already exist in the real upgraded metadata. Do not add substitute indexes.
  ...attendance.map(name=>'ALTER TABLE '+t(name)+' OWNER TO "'+roles.owner+'"'),
  'GRANT USAGE ON SCHEMA '+q+' TO "'+roles.owner+'","'+roles.worker+'"',
  ...foundation.map(name=>'GRANT SELECT ON '+t(name)+' TO "'+roles.owner+'"'),
  ...foundation.map(name=>'CREATE POLICY attendance_private_authority_read ON '+t(name)+' FOR SELECT TO "'+roles.owner+'" USING(true)'),
  'GRANT SELECT,UPDATE(id) ON '+t('fixture_source_write_gate')+' TO "'+roles.owner+'"',
  'CREATE POLICY attendance_private_gate ON '+t('fixture_source_write_gate')+' TO "'+roles.owner+'" USING(id=1) WITH CHECK(false)',
  adapt(candidate.functions[1]),save,read,
  ...['deny_attendance_history_change()','save_attendance(uuid,jsonb)','read_attendance(uuid,text,date)'].flatMap(signature=>{
   const [name,args]=signature.split('(');
   return ['REVOKE ALL ON FUNCTION '+t(name)+'('+args+' FROM PUBLIC','ALTER FUNCTION '+t(name)+'('+args+' OWNER TO "'+roles.owner+'"'];
  }),
  ...candidate.guards.filter(sql=>attendance.some(name=>sql.includes('"'+name+'"'))).map(adapt),
  ...attendance.flatMap(name=>['REVOKE ALL ON '+t(name)+' FROM PUBLIC','ALTER TABLE '+t(name)+' ENABLE ROW LEVEL SECURITY','ALTER TABLE '+t(name)+' FORCE ROW LEVEL SECURITY','CREATE POLICY attendance_private_storage ON '+t(name)+' TO "'+roles.owner+'" USING(true) WITH CHECK(true)']),
  'GRANT EXECUTE ON FUNCTION '+t('save_attendance')+'(uuid,jsonb),'+t('read_attendance')+'(uuid,text,date) TO "'+roles.worker+'"',
 ];
 return{schema,binding:{...binding},roles,foundation,attendance,statements,preflight};
}
