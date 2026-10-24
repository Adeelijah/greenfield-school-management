import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareStagingAcademicFixture, prepareStagingAcademicRehearsalAndApply } from './lib/report-card-staging-academic-fixture-review.mjs';
import { materializeAssessmentSource } from '../src/lib/academics/assessment-canonical-source.ts';
const u=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const config=()=>({mode:'isolated-staging-academic-fixture',projectRef:'hweoqkbgmzycyznrbvng',schoolId:'0c594571-74c5-46fe-a835-a9b217a3a199',sourceCommit:'a'.repeat(40),actors:Object.fromEntries(['admin','teacher','bursar'].map((role,i)=>[role,{authUserId:u(i*3+1),userId:u(i*3+2),membershipId:u(i*3+3)}]))});

test('fictional academic fixture materializes complete numeric and observational sources with real policy',()=>{
 const plan=prepareStagingAcademicFixture(config());
 assert.deepEqual(plan.counts,{academic_sessions:1,terms:3,academic_levels:8,academic_sections:8,classes:8,teacher_class_assignments:2,assessment_subjects:3,assessment_config_versions:2,students:4,enrollments:4,assessment_scopes:2,assessment_subject_roster:3,assessment_teacher_subjects:3,assessment_scores:13});
 assert.equal(new Set(Object.values(plan.tables).flat().map(r=>r.id)).size,64);
 assert.equal(plan.sources.length,2);
 const primary=plan.sources.find(s=>s.stage==='primary');
 const math=primary.materialized.subjects.map(s=>JSON.parse(s.results.canonicalJson)).find(s=>primary.input.catalog.find(c=>c.id===s.subjectId).code==='TEST-MAT');
 const expected=[['TEST-P5-001','90.00','A'],['TEST-P5-002','66.00','B'],['TEST-P5-003','40.00','D']];
 for(const[admission,total,grade]of expected){const student=plan.tables.students.find(s=>s.admission_number===admission);const value=math.students.find(s=>s.studentId===student.id).result;assert.equal(value.total,total);assert.equal(value.grade,grade);}
 const observation=JSON.parse(plan.sources.find(s=>s.stage==='creche').materialized.subjects[0].results.canonicalJson).students[0].result;
 assert.equal(observation.mode,'observational');assert.equal(observation.observations[0].key,'developing');assert.equal('total'in observation,false);
});

test('fixture has deterministic school-bound identities and rejects foreign targets or forged actor references',()=>{
 const original=config(),before=structuredClone(original);const a=prepareStagingAcademicFixture(original),b=prepareStagingAcademicFixture(original);
 assert.equal(a.sql,b.sql);assert.equal(a.sha256,b.sha256);assert.deepEqual(original,before);
 for(const patch of [{mode:'production'},{projectRef:'other'},{schoolId:u(20)},{sourceCommit:'main'},{finalPrimaryYear:6}])assert.throws(()=>prepareStagingAcademicFixture({...config(),...patch}));
 const duplicate=config();duplicate.actors.teacher.membershipId=duplicate.actors.admin.membershipId;assert.throws(()=>prepareStagingAcademicFixture(duplicate));
 const malformed=config();malformed.actors.teacher.authUserId="'; drop table schools;";assert.throws(()=>prepareStagingAcademicFixture(malformed));
});

test('fixture SQL gates discovery and rejects populated state without overwriting academics or fabricating publications',()=>{
 const{sql}=prepareStagingAcademicFixture(config());
 assert.ok(sql.indexOf('WHERE id=1 FOR UPDATE')<sql.indexOf('FROM public.schools'));
 assert.ok(sql.indexOf('pg_advisory_xact_lock')<sql.indexOf('FROM public.memberships'));
 assert.ok(sql.indexOf('requires empty')<sql.indexOf('UPDATE public.schools SET structure_version=1'));
 assert.ok(sql.indexOf('INSERT INTO public.enrollments')<sql.indexOf('INSERT INTO public.assessment_scopes'));
 assert.ok(sql.indexOf('INSERT INTO public.assessment_scopes')<sql.indexOf('INSERT INTO public.assessment_subject_roster'));
 assert.match(sql,/IF NOT marker_exists THEN/);assert.match(sql,/Fixture row mismatch/);assert.match(sql,/Unexpected fixture population/);
 const inserts=[...sql.matchAll(/INSERT INTO public\.([a-z_]+)/g)].map(m=>m[1]);
 for(const name of ['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','report_cards','report_card_snapshots','report_card_releases'])assert.ok(!inserts.includes(name));
 assert.doesNotMatch(sql,/\b(?:DISABLE TRIGGER|session_replication_role|GRANT|REVOKE|DROP TABLE|TRUNCATE|ON CONFLICT)\b/);
 assert.equal([...sql.matchAll(/^BEGIN;$/gm)].length,1);assert.equal([...sql.matchAll(/^COMMIT;$/gm)].length,1);
 assert.equal([...sql.matchAll(/UPDATE public\./g)].length,1);
});

test('actual fixture source cannot be canonicalized with missing scores, out-of-range values or unknown observations',()=>{
 const plan=prepareStagingAcademicFixture(config());
 const missing=structuredClone(plan.sources[0].input);missing.scores.pop();assert.equal(materializeAssessmentSource(missing).ok,false);
 const invalid=structuredClone(plan.sources[0].input);invalid.scores.find(s=>s.componentKey==='ca').numericScore='41.0000';assert.equal(materializeAssessmentSource(invalid).ok,false);
 const unknown=structuredClone(plan.sources[1].input);unknown.scores[0].observationKey='unapproved';assert.equal(materializeAssessmentSource(unknown).ok,false);
});

test('single approved batch restores the rehearsal before identical apply and rejects altered input',()=>{
 const plan=prepareStagingAcademicFixture(config()),batch=prepareStagingAcademicRehearsalAndApply(plan);
 assert.equal([...batch.sql.matchAll(/^BEGIN;$/gm)].length,1);assert.equal([...batch.sql.matchAll(/^COMMIT;$/gm)].length,1);
 assert.equal([...batch.sql.matchAll(/DO \$academic_fixture\$/g)].length,2);
 assert.ok(batch.sql.indexOf('ROLLBACK TO SAVEPOINT academic_fixture_rehearsal')<batch.sql.indexOf('Rehearsal left poisoned revision claims'));
 assert.ok(batch.sql.indexOf('Rehearsal left poisoned revision claims')<batch.sql.lastIndexOf('DO $academic_fixture$'));
 assert.match(batch.sql,/'rollback_rehearsal','PASS'/);
 const start=plan.sql.indexOf('\nBEGIN;\n')+'\nBEGIN;\n'.length,end=plan.sql.indexOf("\nSELECT jsonb_build_object('academic_fixture'");
 assert.equal(batch.sql.split(plan.sql.slice(start,end)).length,3);
 assert.throws(()=>prepareStagingAcademicRehearsalAndApply({...plan,sql:plan.sql+'-- altered'}));
});
