// Pure, fictional staging fixture planning. No driver, environment or execution.
import { createHash } from 'node:crypto';
import { validateAcademicSession, validateTermsForSession } from '../../src/lib/academics/calendar-assessments.ts';
import { validateConfigForPersistence } from '../../src/lib/academics/assessment-persistence-policy.ts';
import { materializeAssessmentSource } from '../../src/lib/academics/assessment-canonical-source.ts';

const school = '0c594571-74c5-46fe-a835-a9b217a3a199';
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const sqlValue = value => value === null ? 'NULL' : typeof value === 'boolean' ? String(value)
  : typeof value === 'number' ? String(value) : typeof value === 'object' ? literal(JSON.stringify(value)) + '::jsonb' : literal(value);
const hash = text => createHash('sha256').update(text).digest('hex');
function id(label) {
  const bytes = createHash('sha1').update(Buffer.from(school.replaceAll('-', ''), 'hex'))
    .update('greenfield.staging.academic-fixture.v1/' + label).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = bytes.toString('hex'); return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}

export function prepareStagingAcademicFixture(config) {
  if (config?.mode !== 'isolated-staging-academic-fixture' || config.projectRef !== 'hweoqkbgmzycyznrbvng' ||
    config.schoolId !== school || typeof config.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(config.sourceCommit) ||
    Object.keys(config).some(key=>!['mode','projectRef','schoolId','sourceCommit','actors'].includes(key))) throw Error('Exact staging fixture target and source required');
  const roleNames = ['admin', 'teacher', 'bursar'];
  if (!config.actors || roleNames.some(role => !config.actors[role] ||
    ['authUserId','userId','membershipId'].some(key => !uuid(config.actors[role][key])))) throw Error('Explicit verified actor bindings required');
  const actorsByRole = Object.fromEntries(roleNames.map(role=>[role,Object.fromEntries(Object.entries(config.actors[role]).map(([key,value])=>[key,typeof value==='string'?value.toLowerCase():value]))]));
  const bindings = roleNames.flatMap(role => Object.values(actorsByRole[role]));
  if (bindings.length !== 9 || new Set(bindings).size !== 9) throw Error('Actor identifiers must be independent');
  const teacher = actorsByRole.teacher.membershipId;
  const tables = {};
  const add = (name, row) => (tables[name] ??= []).push(row);
  const sessionId = id('session'), termId = id('term-1'), marker = id('audit');
  const calendar = { startDate:'2026-09-01', endDate:'2027-07-31' };
  const termDates = [['2026-09-01','2026-12-18'],['2027-01-11','2027-04-09'],['2027-05-03','2027-07-23']];
  if (!validateAcademicSession(calendar) || !validateTermsForSession(calendar, termDates.map(([startDate,endDate],i)=>({number:i+1,startDate,endDate})))) throw Error('Fixture calendar invalid');
  add('academic_sessions',{id:sessionId,school_id:school,label:'TEST 2026/27',starts_on:calendar.startDate,ends_on:calendar.endDate,is_current:true});
  termDates.forEach(([starts_on,ends_on],i)=>add('terms',{id:id('term-'+(i+1)),school_id:school,session_id:sessionId,name:'TEST Term '+(i+1),starts_on,ends_on,is_current:i===0}));
  const levelNames = ['Creche','Nursery 1','Nursery 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5'];
  levelNames.forEach((name,i)=>{
    const stage = i===0?'creche':i<3?'nursery':'primary';
    add('academic_levels',{id:id('level-'+i),school_id:school,name,stage,primary_year:stage==='primary'?i-2:null,progression_order:i+1,is_active:true});
    add('academic_sections',{id:id('section-'+i),school_id:school,level_id:id('level-'+i),name:'A',display_order:1,is_active:true});
    add('classes',{id:id('class-'+i),school_id:school,name:'TEST '+name+' A',section:'A',level_id:id('level-'+i),section_id:id('section-'+i)});
  });
  // Complete parent rows precede scope discovery. Source triggers stay enabled.
  for (const i of [0,7]) add('teacher_class_assignments',{id:id('assignment-'+i),school_id:school,teacher_membership_id:teacher,class_id:id('class-'+i),session_id:sessionId,ended_at:null});
  for (const [key,code,name] of [['math','TEST-MAT','TEST Mathematics'],['english','TEST-ENG','TEST English'],['development','TEST-DEV','TEST Early Development']]) {
    add('assessment_subjects',{id:id('subject-'+key),school_id:school,code,name,is_active:true,version:1});
  }
  const components = [{id:'ca',label:'Test CA',category:'ca',weight:40,maximumScore:40,required:true},{id:'exam',label:'Test Exam',category:'exam',weight:60,maximumScore:60,required:true}];
  const grading = {mode:'numeric',bands:[{min:0,max:50,label:'D'},{min:50,max:60,label:'C'},{min:60,max:70,label:'B'},{min:70,max:100,label:'A'}]};
  for (const i of [7,0]) {
    const observational = i===0;
    add('assessment_config_versions',{id:id('config-'+i),school_id:school,config_key:id('config-key-'+i),revision:1,level_id:id('level-'+i),session_id:sessionId,term_id:termId,subject_id:null,mode:observational?'observational':'numeric',state:'finalized',
      components:observational?[{id:'development',label:'Test development observation',category:'other',weight:100,maximumScore:1,required:true}]:components,
      grading:observational?{mode:'observational',levels:[{id:'emerging',label:'Emerging'},{id:'developing',label:'Developing'},{id:'consistent',label:'Consistent'}]}:grading});
  }
  for (let n=1;n<=4;n++) {
    const i=n===4?0:7;
    add('students',{id:id('student-'+n),school_id:school,admission_number:n===4?'TEST-CRE-001':'TEST-P5-00'+n,first_name:'Fixture',last_name:'Pupil '+n,date_of_birth:null,status:'active'});
    add('enrollments',{id:id('enrollment-'+n),school_id:school,student_id:id('student-'+n),class_id:id('class-'+i),session_id:sessionId,status:'active'});
  }
  for (const i of [7,0]) add('assessment_scopes',{id:id('scope-'+i),school_id:school,class_id:id('class-'+i),session_id:sessionId,term_id:termId,revision:1});
  for (const [key,i] of [['math',7],['english',7],['development',0]]) {
    add('assessment_subject_roster',{id:id('roster-'+key),school_id:school,scope_id:id('scope-'+i),subject_id:id('subject-'+key),roster_version:1,config_version_id:id('config-'+i),is_active:true});
    add('assessment_teacher_subjects',{id:id('teacher-subject-'+key),school_id:school,roster_id:id('roster-'+key),class_assignment_id:id('assignment-'+i),is_active:true});
  }
  const marks = {math:[[35,55],[28,38],[18,22]],english:[[30,50],[20,35],[16,28]]};
  for (const key of ['math','english']) for (let n=1;n<=3;n++) for (const [c,component] of ['ca','exam'].entries()) {
    add('assessment_scores',{id:id('score-'+key+'-'+n+'-'+component),school_id:school,roster_id:id('roster-'+key),config_version_id:id('config-7'),enrollment_id:id('enrollment-'+n),student_id:id('student-'+n),component_key:component,numeric_score:marks[key][n-1][c],observation_key:null,version:1,updated_by:teacher});
  }
  add('assessment_scores',{id:id('score-development'),school_id:school,roster_id:id('roster-development'),config_version_id:id('config-0'),enrollment_id:id('enrollment-4'),student_id:id('student-4'),component_key:'development',numeric_score:null,observation_key:'developing',version:1,updated_by:teacher});
  // Validate using the actual domain policy, not a second grading implementation.
  const toConfig = r => ({id:r.id,schoolId:school,levelId:r.level_id,subjectId:r.subject_id,termId:r.term_id,components:r.components,grading:r.grading,status:r.state,version:r.revision});
  for(const r of tables.assessment_config_versions) if(!validateConfigForPersistence(toConfig(r),r.mode==='numeric'?'primary':'creche'))throw Error('Invalid fixture configuration');
  const sources = [];
  for (const i of [7,0]) {
    const level = tables.academic_levels.find(r=>r.id===id('level-'+i));
    const roster = tables.assessment_subject_roster.filter(r=>r.scope_id===id('scope-'+i));
    const enrollments = tables.enrollments.filter(r=>r.class_id===id('class-'+i));
    const input = {scope:{id:id('scope-'+i),schoolId:school,classId:id('class-'+i),sessionId,termId,revision:2},school:{id:school,finalPrimaryYear:5},
      klass:{id:id('class-'+i),schoolId:school,levelId:level.id,sectionId:id('section-'+i)},level:{id:level.id,schoolId:school,stage:level.stage,primaryYear:level.primary_year,isActive:true},section:{id:id('section-'+i),schoolId:school,levelId:level.id,isActive:true},
      session:{id:sessionId,schoolId:school,startsOn:calendar.startDate,endsOn:calendar.endDate,isCurrent:true},term:{id:termId,schoolId:school,sessionId,startsOn:termDates[0][0],endsOn:termDates[0][1],isCurrent:true},
      students:tables.students.filter(r=>enrollments.some(e=>e.student_id===r.id)).map(r=>({id:r.id,schoolId:school,status:r.status})),
      enrollments:enrollments.map(r=>({id:r.id,schoolId:school,studentId:r.student_id,classId:r.class_id,sessionId,status:r.status})),
      roster:roster.map(r=>({id:r.id,schoolId:school,scopeId:r.scope_id,subjectId:r.subject_id,rosterVersion:r.roster_version,configVersionId:r.config_version_id,isActive:true})),
      catalog:tables.assessment_subjects.filter(r=>roster.some(a=>a.subject_id===r.id)).map(r=>({id:r.id,schoolId:school,code:r.code,name:r.name,version:r.version,isActive:true})),
      configs:tables.assessment_config_versions.filter(r=>r.level_id===level.id).map(r=>({sessionId,config:toConfig(r)})),
      scores:tables.assessment_scores.filter(r=>roster.some(a=>a.id===r.roster_id)).map(r=>({id:r.id,schoolId:school,rosterId:r.roster_id,configVersionId:r.config_version_id,enrollmentId:r.enrollment_id,studentId:r.student_id,componentKey:r.component_key,numericScore:r.numeric_score===null?null:r.numeric_score.toFixed(4),observationKey:r.observation_key,version:r.version,updatedBy:r.updated_by})),
    };
    const built=materializeAssessmentSource(input); if(!built.ok)throw Error('Fixture does not form a complete materializable source');
    sources.push({stage:level.stage,input,materialized:built.materialized});
  }
  const insertion = Object.entries(tables).flatMap(([name,rows])=>rows.map(row=>`INSERT INTO public.${name}(${Object.keys(row).join(',')}) VALUES(${Object.values(row).map(sqlValue).join(',')});`)).join('\n');
  const recordChecks = Object.entries(tables).flatMap(([name,rows])=>rows.map(row=>{
    const expected=name==='assessment_scopes'?{...row,revision:2}:row;
    const nested=Object.entries(expected).filter(([,v])=>v!==null&&typeof v==='object').map(([k,v])=>` AND to_jsonb(t)->${literal(k)}=${literal(JSON.stringify(v))}::jsonb`).join('');
    return `IF NOT EXISTS(SELECT 1 FROM public.${name} t WHERE t.id=${literal(row.id)}::uuid AND to_jsonb(t) @> ${literal(JSON.stringify(expected))}::jsonb${nested}) THEN RAISE EXCEPTION 'Fixture row mismatch: ${name}'; END IF;`;
  })).join('\n');
  const emptyTables = [...Object.keys(tables),'assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts','report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases'];
  const emptyChecks=emptyTables.map(name=>`IF EXISTS(SELECT 1 FROM public.${name} WHERE school_id=${literal(school)}::uuid) THEN RAISE EXCEPTION 'Academic fixture requires empty ${name}; no data is overwritten'; END IF;`).join('\n');
  const countChecks=Object.entries(tables).map(([name,rows])=>`IF (SELECT count(*) FROM public.${name} WHERE school_id=${literal(school)}::uuid)<>${rows.length} THEN RAISE EXCEPTION 'Unexpected fixture population: ${name}'; END IF;`).join('\n');
  const actors=roleNames.map(role=>({role,...actorsByRole[role]}));
  const sql=`-- REVIEW: FICTIONAL ACADEMIC DATA ONLY. Separate target-specific approval required.
-- Project hweoqkbgmzycyznrbvng; source ${config.sourceCommit}; never production.
-- No review/finalization, canonical document, report, snapshot or release is inserted.
-- Sample scores identify the fictional teacher; this does not claim real teacher entry.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
DO $academic_fixture$
DECLARE actor record; marker_exists boolean;
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' THEN RAISE EXCEPTION 'Staging operator required'; END IF;
 PERFORM id FROM public.assessment_source_write_gate WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Installed source gate missing'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('greenfield.report-card.authority-gate.v1',0));
 PERFORM id FROM public.schools WHERE id=${literal(school)}::uuid AND name='Greenfield Staging' AND slug='greenfield-staging' AND final_primary_year=5 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reviewed staging school missing'; END IF;
 FOR actor IN SELECT * FROM pg_catalog.jsonb_to_recordset(${literal(JSON.stringify(actors))}::jsonb) AS a(role text,"authUserId" uuid,"userId" uuid,"membershipId" uuid) LOOP
  IF NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.school_users u ON u.id=m.user_id WHERE m.id=actor."membershipId" AND u.id=actor."userId" AND u.auth_user_id=actor."authUserId" AND m.school_id=${literal(school)}::uuid AND m.role::text=actor.role AND m.status='active') OR (SELECT count(*) FROM public.memberships WHERE user_id=actor."userId")<>1 THEN RAISE EXCEPTION 'Actor binding changed'; END IF;
 END LOOP;
 SELECT EXISTS(SELECT 1 FROM public.audit_events WHERE id=${literal(marker)}::uuid) INTO marker_exists;
 IF NOT marker_exists THEN
  IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=${literal(school)}::uuid AND structure_version=0) THEN RAISE EXCEPTION 'School structure version changed'; END IF;
  ${emptyChecks}
  UPDATE public.schools SET structure_version=1 WHERE id=${literal(school)}::uuid AND structure_version=0;
  ${insertion}
  INSERT INTO public.audit_events(id,school_id,actor_user_id,action,entity_type,entity_id) VALUES(${literal(marker)}::uuid,${literal(school)}::uuid,NULL,'staging_academic_fixture_v1','school',${literal(school)}::uuid);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE id=${literal(marker)}::uuid AND school_id=${literal(school)}::uuid AND actor_user_id IS NULL AND action='staging_academic_fixture_v1' AND entity_type='school' AND entity_id=${literal(school)}::uuid) THEN RAISE EXCEPTION 'Fixture marker conflicts'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=${literal(school)}::uuid AND structure_version=1) THEN RAISE EXCEPTION 'Fixture structure version differs'; END IF;
 ${recordChecks}
 ${countChecks}
END $academic_fixture$;
SELECT jsonb_build_object('academic_fixture','PASS','school_id',${literal(school)},'counts',${literal(JSON.stringify(Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))))}::jsonb,'scope_revision',2,'source_finalized',false,'application_enabled',false) AS academic_fixture_result;
COMMIT;
`;
  return {status:'review-only',projectRef:config.projectRef,schoolId:school,sourceCommit:config.sourceCommit,sql,sha256:hash(sql),tables,sources,fixtureMarker:marker,counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))};
}

/** One approved operator batch: rehearse under a savepoint, verify restoration,
 * then apply the identical fixture body. Any error aborts before outer COMMIT.
 * No database connection or execution occurs in this builder.
 */
export function prepareStagingAcademicRehearsalAndApply(plan) {
  if (plan?.projectRef!=='hweoqkbgmzycyznrbvng' || plan.schoolId!==school || typeof plan.sql!=='string' ||
    hash(plan.sql)!==plan.sha256 || !uuid(plan.fixtureMarker)) throw Error('Intact reviewed staging plan required');
  const begin=plan.sql.indexOf('\nBEGIN;\n'), report=plan.sql.indexOf("\nSELECT jsonb_build_object('academic_fixture'");
  if(begin<0||report<begin||!plan.sql.endsWith('\nCOMMIT;\n'))throw Error('Expected bounded fixture transaction');
  const names=Object.keys(plan.counts);
  const inserted=[...new Set([...plan.sql.matchAll(/INSERT INTO public\.([a-z_]+)/g)].map(m=>m[1]))].filter(n=>n!=='audit_events');
  if(names.length!==inserted.length||names.some(n=>!/^[a-z_]+$/.test(n)||!inserted.includes(n)))throw Error('Unexpected fixture relation inventory');
  const scopes=plan.tables.assessment_scopes.map(r=>r.id);
  if(scopes.length!==2||!scopes.every(uuid))throw Error('Expected two fixture scopes');
  const restore=names.map(name=>`IF EXISTS(SELECT 1 FROM public.${name} WHERE school_id=${literal(school)}::uuid) THEN RAISE EXCEPTION 'Rehearsal left ${name} rows'; END IF;`).join('\n');
  const body=plan.sql.slice(begin+'\nBEGIN;\n'.length,report);
  const result=plan.sql.slice(report,-'COMMIT;\n'.length).replace("'academic_fixture','PASS'","'academic_fixture','PASS','rollback_rehearsal','PASS'");
  const sql=`-- REVIEW: fictional staging academics; approval covers rehearsal then apply.
-- Target hweoqkbgmzycyznrbvng; school ${school}; source ${plan.sourceCommit}.
-- Fixture body SHA-256 ${plan.sha256}. No live-school defaults or publications.
-- Run as one complete SQL Editor batch. On any error run ROLLBACK; and send the error.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL statement_timeout='60s';
SET LOCAL lock_timeout='5s';
SAVEPOINT academic_fixture_rehearsal;
${body}
ROLLBACK TO SAVEPOINT academic_fixture_rehearsal;
DO $fixture_restore_check$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.audit_events WHERE id=${literal(plan.fixtureMarker)}::uuid) THEN
  IF NOT EXISTS(SELECT 1 FROM public.schools WHERE id=${literal(school)}::uuid AND structure_version=0) THEN RAISE EXCEPTION 'Rehearsal did not restore structure version'; END IF;
  ${restore}
 END IF;
 IF EXISTS(SELECT 1 FROM public.assessment_source_write_claims WHERE transaction_id=pg_catalog.pg_current_xact_id()::text AND scope_id IN (${scopes.map(s=>literal(s)+'::uuid').join(',')})) THEN
  RAISE EXCEPTION 'Rehearsal left poisoned revision claims'; END IF;
END $fixture_restore_check$;
RELEASE SAVEPOINT academic_fixture_rehearsal;
-- Apply only after successful fixture and rollback-restoration checks.
${body}
${result}COMMIT;
`;
  return {status:'review-only',sql,sha256:hash(sql),fixtureSha256:plan.sha256};
}
