// Closed score-save request only. No caller identity, totals, hashes or review flags.
export type SubjectScoreCell={studentId:string;enrollmentId:string;componentKey:string;expectedVersion:number;numericScore:string|null;observationKey:string|null};
export type SubjectScoreCommand={action:'save_subject_scores';classKey:'primary5'|'creche';rosterId:string;configVersionId:string;expectedConfigRevision:number;expectedRosterVersion:number;expectedScopeRevision:number;operationKey:string;reason:string|null;scores:SubjectScoreCell[]};
export type SubjectScoreOutcome={ok:true;kind:'applied'|'replay';revision:number}|{ok:false;code:'invalid'|'forbidden'|'conflict'|'unavailable'};
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const integer=(v:unknown,min:number)=>Number.isInteger(v)&&Number(v)>=min&&Number(v)<2147483647;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
export function parseSubjectScoreCommand(value:unknown):SubjectScoreCommand|null{
 if(!record(value)||!exact(value,['action','classKey','rosterId','configVersionId','expectedConfigRevision','expectedRosterVersion','expectedScopeRevision','operationKey','reason','scores']))return null;
 const r=value;
 if(r.action!=='save_subject_scores'||(r.classKey!=='primary5'&&r.classKey!=='creche')||!uuid(r.rosterId)||!uuid(r.configVersionId)||!integer(r.expectedConfigRevision,1)||!integer(r.expectedRosterVersion,1)||!integer(r.expectedScopeRevision,1)||typeof r.operationKey!=='string'||!/^[A-Za-z0-9:_-]{8,120}$/.test(r.operationKey)||!Array.isArray(r.scores)||!r.scores.length||r.scores.length>10000)return null;
 if(r.reason!==null&&(typeof r.reason!=='string'||!r.reason.trim()||r.reason.trim().length>2000))return null;
 const cells:SubjectScoreCell[]=[];const seen=new Set<string>();
 for(const s of r.scores){
  if(!record(s)||!exact(s,['studentId','enrollmentId','componentKey','expectedVersion','numericScore','observationKey'])||!uuid(s.studentId)||!uuid(s.enrollmentId)||typeof s.componentKey!=='string'||!s.componentKey.trim()||s.componentKey.length>128||s.componentKey!==s.componentKey.trim()||!integer(s.expectedVersion,0))return null;
  if(s.numericScore!==null&&(typeof s.numericScore!=='string'||!/^(0|[1-9]\d{0,7})(?:\.\d{1,4})?$/.test(s.numericScore)))return null;
  if(s.observationKey!==null&&(typeof s.observationKey!=='string'||!s.observationKey.trim()||s.observationKey.length>128||s.observationKey!==s.observationKey.trim()))return null;
  if(s.numericScore!==null&&s.observationKey!==null)return null;
  const key=s.enrollmentId.toLowerCase()+':'+s.componentKey;if(seen.has(key))return null;seen.add(key);
  const decimal=typeof s.numericScore==='string'&&s.numericScore.includes('.')?s.numericScore.replace(/0+$/,'').replace(/\.$/,''):s.numericScore;
  cells.push({studentId:s.studentId.toLowerCase(),enrollmentId:s.enrollmentId.toLowerCase(),componentKey:s.componentKey,expectedVersion:Number(s.expectedVersion),numericScore:decimal as string|null,observationKey:s.observationKey as string|null});
 }
 if(cells.some(s=>s.expectedVersion>0)&&r.reason===null)return null;
 cells.sort((a,b)=>a.enrollmentId<b.enrollmentId?-1:a.enrollmentId>b.enrollmentId?1:a.componentKey<b.componentKey?-1:a.componentKey>b.componentKey?1:0);
 return{action:'save_subject_scores',classKey:r.classKey,rosterId:r.rosterId.toLowerCase(),configVersionId:r.configVersionId.toLowerCase(),expectedConfigRevision:Number(r.expectedConfigRevision),expectedRosterVersion:Number(r.expectedRosterVersion),expectedScopeRevision:Number(r.expectedScopeRevision),operationKey:r.operationKey,reason:typeof r.reason==='string'?r.reason.trim():null,scores:cells};
}
export function decodeSubjectScoreOutcome(value:unknown):SubjectScoreOutcome|null{
 if(!record(value))return null;
 if(value.ok===true&&exact(value,['ok','kind','revision'])&&(value.kind==='applied'||value.kind==='replay')&&Number.isInteger(value.revision)&&Number(value.revision)>1&&Number(value.revision)<=2147483647)return{ok:true,kind:value.kind,revision:Number(value.revision)};
 if(value.ok===false&&exact(value,['ok','code'])&&(value.code==='invalid'||value.code==='forbidden'||value.code==='conflict'))return{ok:false,code:value.code};return null;
}
