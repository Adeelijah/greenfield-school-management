// Closed requests: canonical documents, actor/school and grade results are server-owned.
export type AssessmentReviewCommand={action:'review_subject';classId:string;sessionId:string;termId:string;rosterId:string;expectedScopeRevision:number;operationKey:string}|{action:'finalize_subject';classId:string;sessionId:string;termId:string;rosterId:string;expectedScopeRevision:number;operationKey:string;teacherReviewId:string};
export type AssessmentReviewOutcome={ok:true;kind:'applied'|'replay';action:AssessmentReviewCommand['action'];revision:number;sourceVersionId:string;reviewId:string;finalizationId:string|null}|{ok:false;code:'invalid'|'forbidden'|'conflict'|'incomplete_source'|'source_mismatch'|'review_required'|'unavailable'};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
export function parseAssessmentReviewCommand(raw:unknown):AssessmentReviewCommand|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const r=raw as Record<string,unknown>;
 if(r.action!=='review_subject'&&r.action!=='finalize_subject')return null;
 const keys=['action','classId','sessionId','termId','rosterId','expectedScopeRevision','operationKey',...(r.action==='finalize_subject'?['teacherReviewId']:[])];
 if(Object.keys(r).length!==keys.length||Object.keys(r).some(k=>!keys.includes(k))||![r.classId,r.sessionId,r.termId,r.rosterId].every(uuid)||!Number.isInteger(r.expectedScopeRevision)||Number(r.expectedScopeRevision)<1||Number(r.expectedScopeRevision)>=2147483647||typeof r.operationKey!=='string'||!/^[A-Za-z0-9:_-]{8,120}$/.test(r.operationKey)||r.action==='finalize_subject'&&!uuid(r.teacherReviewId))return null;
 const common={classId:(r.classId as string).toLowerCase(),sessionId:(r.sessionId as string).toLowerCase(),termId:(r.termId as string).toLowerCase(),rosterId:(r.rosterId as string).toLowerCase(),expectedScopeRevision:Number(r.expectedScopeRevision),operationKey:r.operationKey};
 return r.action==='review_subject'?{action:r.action,...common}:{action:r.action,...common,teacherReviewId:(r.teacherReviewId as string).toLowerCase()};
}
export function decodeAssessmentReviewSuccess(raw:unknown):Extract<AssessmentReviewOutcome,{ok:true}>|null{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;const r=raw as Record<string,unknown>;
 if(Object.keys(r).length!==7||r.ok!==true||(r.kind!=='applied'&&r.kind!=='replay')||(r.action!=='review_subject'&&r.action!=='finalize_subject')||!Number.isInteger(r.revision)||Number(r.revision)<1||Number(r.revision)>=2147483647||!uuid(r.sourceVersionId)||!uuid(r.reviewId)||(r.action==='review_subject'?r.finalizationId!==null:!uuid(r.finalizationId)))return null;
 return{ok:true,kind:r.kind,action:r.action,revision:Number(r.revision),sourceVersionId:r.sourceVersionId,reviewId:r.reviewId,finalizationId:r.finalizationId as string|null};
}
