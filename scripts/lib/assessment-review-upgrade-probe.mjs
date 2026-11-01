// Local upgraded fixture workload only; owner SQL transport, not a deployed role/SDK.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {executeFixtureAssessmentReview,executeRestrictedFixtureAssessmentReview} from '../../src/lib/academics/assessment-postgres-review-fixture.ts';
import {upgradeFixtureSchema} from './report-card-upgrade-plan.mjs';
export async function probeAssessmentReviewUpgrade(db,schema,selector,{schoolId,scopeId,rosterId,teacherAuth,adminAuth},reviewRuntime){
 const q=upgradeFixtureSchema(schema),table=n=>q+'."'+n+'"',names=['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts'];
 const snapshot=async()=>{const state={};for(const name of names)state[name]=Array.from(await db.unsafe('SELECT to_jsonb(r) AS row FROM '+table(name)+' r ORDER BY to_jsonb(r)::text'));return JSON.stringify(state);};
 const revision=(await db.unsafe('SELECT revision FROM '+table('assessment_scopes')+' WHERE school_id=$1::uuid AND id=$2::uuid',[schoolId,scopeId]))[0].revision;
 const command={action:'review_subject',...selector,rosterId,expectedScopeRevision:revision,operationKey:'upgrade-review-subject-'+revision};
 const port=(fail,outer=false,database=reviewRuntime?.database??db)=>({unsafe(){throw Error('Transaction only');},begin:work=>database.begin(async tx=>{const result=await work({unsafe:async(sql,params)=>{const rows=Array.from(await tx.unsafe(sql,params));if(fail&&sql.startsWith('INSERT INTO '+table(fail)))throw Error('Injected assessment review persistence failure');return rows;}});if(outer)throw Error('Injected assessment review outer failure');return result;})});
 const run=(c,auth,fail,outer,database)=>reviewRuntime?executeRestrictedFixtureAssessmentReview(port(fail,outer,database),schema,schoolId,async()=>({authUserId:auth}),c):executeFixtureAssessmentReview(port(fail,outer,database),schema,async()=>({authUserId:auth}),c);
 const baseline=await snapshot();
 assert.equal((await run(command,adminAuth)).code,'forbidden');assert.equal(await snapshot(),baseline);
 for(const fail of ['assessment_source_versions','assessment_teacher_reviews','assessment_audit','assessment_operation_receipts']){assert.equal((await run(command,teacherAuth,fail)).code,'unavailable',fail);assert.equal(await snapshot(),baseline,fail);}
 assert.equal((await run(command,teacherAuth,null,true)).code,'unavailable');assert.equal(await snapshot(),baseline);
 const reviewPair=reviewRuntime?await Promise.all([run(command,teacherAuth),run(command,teacherAuth,null,false,reviewRuntime.secondDatabase)]):[await run(command,teacherAuth)];if(reviewRuntime)assert.deepEqual(reviewPair.map(r=>r.kind).sort(),['applied','replay']);
 const review=reviewPair.find(r=>r.kind==='applied')??reviewPair[0];assert.equal(review.ok,true,JSON.stringify(review));assert.equal(review.revision,revision);
 const afterReview=await snapshot();assert.deepEqual(await run(command,teacherAuth),{...review,kind:'replay'});assert.equal(await snapshot(),afterReview);
 assert.equal((await run({...command,operationKey:'upgrade-duplicate-review-'+revision},teacherAuth)).code,'conflict');assert.equal(await snapshot(),afterReview);
 assert.equal((await run({...command,expectedScopeRevision:revision+1},teacherAuth)).code,'conflict');assert.equal(await snapshot(),afterReview);
 const finalize={...command,action:'finalize_subject',operationKey:'upgrade-finalize-subject-'+revision,teacherReviewId:review.reviewId};
 assert.equal((await run(finalize,teacherAuth)).code,'forbidden');assert.equal(await snapshot(),afterReview);
 for(const fail of ['assessment_finalizations','assessment_audit','assessment_operation_receipts']){assert.equal((await run(finalize,adminAuth,fail)).code,'unavailable',fail);assert.equal(await snapshot(),afterReview,fail);}
 const finalPair=reviewRuntime?await Promise.all([run(finalize,adminAuth),run(finalize,adminAuth,null,false,reviewRuntime.secondDatabase)]):[await run(finalize,adminAuth)];if(reviewRuntime)assert.deepEqual(finalPair.map(r=>r.kind).sort(),['applied','replay']);
 const finalized=finalPair.find(r=>r.kind==='applied')??finalPair[0];assert.equal(finalized.ok,true,JSON.stringify(finalized));assert.equal(finalized.sourceVersionId,review.sourceVersionId);assert.equal(finalized.reviewId,review.reviewId);assert.equal(finalized.revision,revision);
 const afterFinal=await snapshot();assert.deepEqual(await run(finalize,adminAuth),{...finalized,kind:'replay'});assert.equal(await snapshot(),afterFinal);
 assert.equal((await db.unsafe('SELECT revision FROM '+table('assessment_scopes')+' WHERE id=$1::uuid',[scopeId]))[0].revision,revision);
 if(reviewRuntime){
  const foreignSchool=randomUUID(),foreignMembership=randomUUID(),teacherUser=(await db.unsafe('SELECT id FROM '+table('school_users')+' WHERE auth_user_id=$1::uuid',[teacherAuth]))[0].id;
  await db.unsafe('INSERT INTO '+table('schools')+" (id,name,slug,final_primary_year) VALUES($1,'Review foreign fixture',$2,5)",[foreignSchool,'review-'+foreignSchool]);
  try{
   await db.unsafe('INSERT INTO '+table('memberships')+" (id,school_id,user_id,role) VALUES($1,$2,$3,'teacher')",[foreignMembership,foreignSchool,teacherUser]);
   const visible=await reviewRuntime.database.begin(tx=>tx.unsafe('SELECT id FROM '+table('memberships')+" WHERE user_id=$1::uuid AND status='active'",[teacherUser]));assert.equal(visible.length,1);
   assert.equal((await run(command,teacherAuth)).code,'forbidden');
   assert.equal((await run({...finalize,operationKey:'hidden-reviewer-final-'+revision},adminAuth)).code,'forbidden');
   await db.unsafe('UPDATE '+table('memberships')+" SET status='suspended' WHERE id=$1::uuid",[foreignMembership]);
   assert.deepEqual(await run(command,teacherAuth),{...review,kind:'replay'});
   for(const [auth,c] of [[teacherAuth,command],[adminAuth,finalize]]){
    const user=(await db.unsafe('SELECT id FROM '+table('school_users')+' WHERE auth_user_id=$1::uuid',[auth]))[0].id;
    const member=(await db.unsafe('SELECT id FROM '+table('memberships')+" WHERE school_id=$1::uuid AND user_id=$2::uuid AND status='active'",[schoolId,user]))[0].id;
    await db.unsafe('UPDATE '+table('memberships')+" SET status='suspended' WHERE id=$1::uuid",[member]);
    try{assert.equal((await run(c,auth)).code,'forbidden');}finally{await db.unsafe('UPDATE '+table('memberships')+" SET status='active' WHERE id=$1::uuid",[member]);}
   }
   console.log('PASS: restricted review authority rejects a hidden second school for actors and finalization reviewers; suspension denies historical receipts and suspended history recovers');
  }finally{await db.unsafe('DELETE FROM '+table('memberships')+' WHERE id=$1::uuid',[foreignMembership]);await db.unsafe('DELETE FROM '+table('schools')+' WHERE id=$1::uuid',[foreignSchool]);}
  assert.equal(await snapshot(),afterFinal);
  let signal,failReady,release;
  const ready=new Promise((yes,no)=>{signal=yes;failReady=no;}),hold=new Promise(yes=>{release=yes;});
  const held=reviewRuntime.database.begin(async tx=>{const inner={unsafe(){throw Error('Transaction only');},begin:fn=>fn(tx)};assert.equal((await executeRestrictedFixtureAssessmentReview(inner,schema,schoolId,async()=>({authUserId:teacherAuth}),command)).ok,true);signal();await hold;});
  held.catch(failReady);
  try{await ready;await assert.rejects(db.begin(async tx=>{await tx.unsafe("SET LOCAL lock_timeout='200ms'");await tx.unsafe('UPDATE '+table('school_users')+' SET id=id WHERE false');}),e=>e.code==='55P03');}finally{release();await held;}
  let signalParent,failParent,releaseParent;
  const parentReady=new Promise((yes,no)=>{signalParent=yes;failParent=no;}),parentHold=new Promise(yes=>{releaseParent=yes;});
  const parent=db.begin(async tx=>{await tx.unsafe('UPDATE '+table('school_users')+' SET id=id WHERE false');signalParent();await parentHold;});parent.catch(failParent);
  let sqlCode;
  try{await parentReady;const waiting={unsafe(){throw Error('Transaction only');},begin:fn=>reviewRuntime.database.begin(async tx=>{await tx.unsafe("SET LOCAL lock_timeout='200ms'");return fn({unsafe:async(q,p)=>{try{return await tx.unsafe(q,p);}catch(e){sqlCode=e.code;throw e;}}});})};assert.equal((await executeRestrictedFixtureAssessmentReview(waiting,schema,schoolId,async()=>({authUserId:teacherAuth}),command)).code,'unavailable');assert.equal(sqlCode,'55P03');}finally{releaseParent();await parent;}
  assert.deepEqual(await run(command,teacherAuth),{...review,kind:'replay'});assert.equal(await snapshot(),afterFinal);
  console.log('PASS: restricted in-flight review replay and zero-row authority writer block in both arrival orders, with exact receipt history after lock release');
 }
 if(reviewRuntime)console.log('PASS: two independent restricted review backends serialize teacher review and admin finalization, applying once and replaying once');
 console.log('PASS: actual upgraded teacher review and independent admin finalization materialize canonical source without advancing revision; retries replay exact history');
 console.log('PASS: actual source/review/finalization/audit/receipt and outer failures roll back all review effects; same operation keys recover');
 return{review,finalized};
}
