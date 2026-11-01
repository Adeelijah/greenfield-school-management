// Local upgraded fixture workload only; owner SQL transport, not a deployed role/SDK.
import assert from 'node:assert/strict';
import {executeFixtureAssessmentReview} from '../../src/lib/academics/assessment-postgres-review-fixture.ts';
import {upgradeFixtureSchema} from './report-card-upgrade-plan.mjs';
export async function probeAssessmentReviewUpgrade(db,schema,selector,{schoolId,scopeId,rosterId,teacherAuth,adminAuth}){
 const q=upgradeFixtureSchema(schema),table=n=>q+'."'+n+'"',names=['assessment_source_versions','assessment_teacher_reviews','assessment_finalizations','assessment_audit','assessment_operation_receipts'];
 const snapshot=async()=>{const state={};for(const name of names)state[name]=Array.from(await db.unsafe('SELECT to_jsonb(r) AS row FROM '+table(name)+' r ORDER BY to_jsonb(r)::text'));return JSON.stringify(state);};
 const revision=(await db.unsafe('SELECT revision FROM '+table('assessment_scopes')+' WHERE school_id=$1::uuid AND id=$2::uuid',[schoolId,scopeId]))[0].revision;
 const command={action:'review_subject',...selector,rosterId,expectedScopeRevision:revision,operationKey:'upgrade-review-subject-'+revision};
 const port=(fail,outer=false)=>({unsafe(){throw Error('Transaction only');},begin:work=>db.begin(async tx=>{const result=await work({unsafe:async(sql,params)=>{const rows=Array.from(await tx.unsafe(sql,params));if(fail&&sql.startsWith('INSERT INTO '+table(fail)))throw Error('Injected assessment review persistence failure');return rows;}});if(outer)throw Error('Injected assessment review outer failure');return result;})});
 const run=(c,auth,fail,outer)=>executeFixtureAssessmentReview(port(fail,outer),schema,async()=>({authUserId:auth}),c);
 const baseline=await snapshot();
 assert.equal((await run(command,adminAuth)).code,'forbidden');assert.equal(await snapshot(),baseline);
 for(const fail of ['assessment_source_versions','assessment_teacher_reviews','assessment_audit','assessment_operation_receipts']){assert.equal((await run(command,teacherAuth,fail)).code,'unavailable',fail);assert.equal(await snapshot(),baseline,fail);}
 assert.equal((await run(command,teacherAuth,null,true)).code,'unavailable');assert.equal(await snapshot(),baseline);
 const review=await run(command,teacherAuth);assert.equal(review.ok,true,JSON.stringify(review));assert.equal(review.revision,revision);
 const afterReview=await snapshot();assert.deepEqual(await run(command,teacherAuth),{...review,kind:'replay'});assert.equal(await snapshot(),afterReview);
 assert.equal((await run({...command,operationKey:'upgrade-duplicate-review-'+revision},teacherAuth)).code,'conflict');assert.equal(await snapshot(),afterReview);
 assert.equal((await run({...command,expectedScopeRevision:revision+1},teacherAuth)).code,'conflict');assert.equal(await snapshot(),afterReview);
 const finalize={...command,action:'finalize_subject',operationKey:'upgrade-finalize-subject-'+revision,teacherReviewId:review.reviewId};
 assert.equal((await run(finalize,teacherAuth)).code,'forbidden');assert.equal(await snapshot(),afterReview);
 for(const fail of ['assessment_finalizations','assessment_audit','assessment_operation_receipts']){assert.equal((await run(finalize,adminAuth,fail)).code,'unavailable',fail);assert.equal(await snapshot(),afterReview,fail);}
 const finalized=await run(finalize,adminAuth);assert.equal(finalized.ok,true,JSON.stringify(finalized));assert.equal(finalized.sourceVersionId,review.sourceVersionId);assert.equal(finalized.reviewId,review.reviewId);assert.equal(finalized.revision,revision);
 const afterFinal=await snapshot();assert.deepEqual(await run(finalize,adminAuth),{...finalized,kind:'replay'});assert.equal(await snapshot(),afterFinal);
 assert.equal((await db.unsafe('SELECT revision FROM '+table('assessment_scopes')+' WHERE id=$1::uuid',[scopeId]))[0].revision,revision);
 console.log('PASS: actual upgraded teacher review and independent admin finalization materialize canonical source without advancing revision; retries replay exact history');
 console.log('PASS: actual source/review/finalization/audit/receipt and outer failures roll back all review effects; same operation keys recover');
 return{review,finalized};
}
