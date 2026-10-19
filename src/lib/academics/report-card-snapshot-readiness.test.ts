import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node 22 type stripping requires explicit source extension.
import { inspectSnapshotSource } from './report-card-snapshot-readiness.ts';
const valid={schoolId:'school',reportId:'report',studentId:'student',enrollmentId:'enrollment',classId:'class',sessionId:'session',termId:'term',assessmentRevision:3,subjectIds:['math','english'],finalizedSubjectIds:['math','english'],sourceVersionKeys:['assessment:3','grading:2']};
test('complete finalized roster and version binding is ready for canonicalization',()=>assert.deepEqual(inspectSnapshotSource(valid),{ready:true}));
test('missing identity and invalid revision fail closed',()=>{
 assert.equal(inspectSnapshotSource({...valid,enrollmentId:''}).ready,false);
 assert.equal(inspectSnapshotSource({...valid,assessmentRevision:-1}).ready,false);
});
test('missing, duplicate or extra finalized subjects fail closed',()=>{
 for(const finalizedSubjectIds of [['math'],['math','math'],['math','science']]) assert.equal(inspectSnapshotSource({...valid,finalizedSubjectIds}).ready,false);
 assert.equal(inspectSnapshotSource({...valid,subjectIds:['math','math']}).ready,false);
});
test('missing or duplicate source versions fail closed',()=>{
 assert.equal(inspectSnapshotSource({...valid,sourceVersionKeys:[]}).ready,false);
 assert.equal(inspectSnapshotSource({...valid,sourceVersionKeys:['x','x']}).ready,false);
});
