import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node type stripping requires explicit source extension.
import { verifyReportSnapshotSource, type TrustedSourceRows } from './report-card-trusted-source.ts';
const binding = { schoolId:'school-a', reportId:'report', studentId:'student', enrollmentId:'enroll-1', classId:'class', sessionId:'session', termId:'term', assessmentRevision:4, subjectIds:['math','english'], finalizedSubjectIds:['math','english'], sourceVersionKeys:['math:4','english:4'] };
const rows:TrustedSourceRows = { schoolId:'school-a', assessmentRevision:4,
 enrollments:[{id:'enroll-1',schoolId:'school-a',studentId:'student',classId:'class',sessionId:'session',status:'active'},{id:'old',schoolId:'school-a',studentId:'student',classId:'old-class',sessionId:'old-session',status:'completed'}],
 subjects:['math','english'].map(subjectId=>({schoolId:'school-a',classId:'class',sessionId:'session',termId:'term',subjectId,finalized:true,assessmentRevision:4,sourceVersionKey:subjectId+':4'})),
};
test('accepts one active enrollment, historical enrollment and finalized source roster',()=>{ assert.deepEqual(verifyReportSnapshotSource(binding,rows),{ok:true}); });
test('rejects duplicate active enrollment and mismatched enrollment identity',()=>{
 assert.equal(verifyReportSnapshotSource(binding,{...rows,enrollments:[...rows.enrollments,{...rows.enrollments[0]!,id:'duplicate'}]}).ok,false);
 assert.equal(verifyReportSnapshotSource({...binding,enrollmentId:'forged'},rows).ok,false);
});
test('rejects cross-school and stale revisions',()=>{
 assert.equal(verifyReportSnapshotSource(binding,{...rows,schoolId:'school-b'}).ok,false);
 assert.equal(verifyReportSnapshotSource(binding,{...rows,assessmentRevision:5}).ok,false);
 assert.equal(verifyReportSnapshotSource(binding,{...rows,subjects:[{...rows.subjects[0]!,schoolId:'school-b'},rows.subjects[1]!]}).ok,false);
});
test('rejects incomplete, duplicate, unfinalized and stale subject sources',()=>{
 assert.equal(verifyReportSnapshotSource(binding,{...rows,subjects:rows.subjects.slice(0,1)}).ok,false);
 assert.equal(verifyReportSnapshotSource(binding,{...rows,subjects:[rows.subjects[0]!,rows.subjects[0]!]}).ok,false);
 assert.equal(verifyReportSnapshotSource(binding,{...rows,subjects:[{...rows.subjects[0]!,finalized:false},rows.subjects[1]!]}).ok,false);
 assert.equal(verifyReportSnapshotSource(binding,{...rows,subjects:[{...rows.subjects[0]!,assessmentRevision:3},rows.subjects[1]!]}).ok,false);
});
test('rejects source version substitutions',()=>{
 assert.equal(verifyReportSnapshotSource({...binding,sourceVersionKeys:['math:4','english:5']},rows).ok,false);
});
