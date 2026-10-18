// Pure persistence-boundary rules. No database access or authentication.
export type ReportWriteIntent = { schoolId:string; reportId:string; actorMembershipId:string; operationKey:string; fingerprint:string; expectedVersion:number };
export type ReportStoredReceipt = { schoolId:string; reportId:string; actorMembershipId:string; operationKey:string; fingerprint:string; resultingVersion:number };
export type ReportWriteDecision = {ok:true;kind:'new'} | {ok:true;kind:'replay';resultingVersion:number} | {ok:false;code:'invalid'|'school_mismatch'|'conflict'|'stale_version'};
export function planReportWrite(intent:ReportWriteIntent, persisted:{schoolId:string;id:string;version:number}, receipts:readonly ReportStoredReceipt[]):ReportWriteDecision {
 if (!intent || !persisted || !intent.schoolId?.trim() || !intent.reportId?.trim() || !intent.actorMembershipId?.trim() || !intent.operationKey?.trim() || !/^[a-f0-9]{64}$/i.test(intent.fingerprint) || !Number.isSafeInteger(intent.expectedVersion) || intent.expectedVersion<1 || !Number.isSafeInteger(persisted.version) || persisted.version<1 || !Array.isArray(receipts)) return {ok:false,code:'invalid'};
 if (intent.schoolId!==persisted.schoolId || intent.reportId!==persisted.id || receipts.some(r=>r.schoolId!==intent.schoolId)) return {ok:false,code:'school_mismatch'};
 const matching=receipts.filter(r=>r.actorMembershipId===intent.actorMembershipId && r.operationKey===intent.operationKey);
 if (matching.length>1) return {ok:false,code:'conflict'};
 if (matching.length===1) {
  const previous=matching[0]!;
  if (previous.reportId!==intent.reportId || previous.fingerprint!==intent.fingerprint || !Number.isSafeInteger(previous.resultingVersion)) return {ok:false,code:'conflict'};
  return {ok:true,kind:'replay',resultingVersion:previous.resultingVersion};
 }
 if (intent.expectedVersion!==persisted.version) return {ok:false,code:'stale_version'};
 return {ok:true,kind:'new'};
}
export type ReportRelease = {schoolId:string;studentId:string;stage:'draft'|'submitted'|'returned'|'approved'|'published';releasedVersion:number|null;reportVersion:number;revoked:boolean};
export type GuardianLink = {schoolId:string;studentId:string;guardianId:string;active:boolean};
export function canReadReleasedReport(release:ReportRelease, guardian:{id:string;schoolId:string}|null, links:readonly GuardianLink[]):boolean {
 if (!release || !guardian?.id || !guardian.schoolId || !Array.isArray(links) || links.some(l=>l.schoolId!==guardian.schoolId)) return false;
 return release.schoolId===guardian.schoolId && release.stage==='published' && !release.revoked && Number.isSafeInteger(release.releasedVersion) && release.releasedVersion!==null && release.releasedVersion===release.reportVersion && links.some(l=>l.schoolId===guardian.schoolId && l.guardianId===guardian.id && l.studentId===release.studentId && l.active);
}
