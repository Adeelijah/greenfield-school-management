// Disposable test-only PostgreSQL adapter for the existing transaction port.
// Not imported by the application, not production schema, and not an auth provider.
import type { TransactionRunner, ReportTransaction, LockedReport } from './report-card-transaction-port';
import type { ReportStoredReceipt } from './report-card-persistence-policy';
import type { ReportAudit, ReportRecord } from './report-card-workflow';
import type { ReportTrustedContext } from './report-card-preflight';
import type { ReportCardDraft } from './report-cards';

export type SqlClient = {
  unsafe(query:string,params?:unknown[]):Promise<Record<string,unknown>[]>;
};
export type SqlDatabase = SqlClient & {
  begin<T>(callback:(tx:SqlClient)=>Promise<T>):Promise<T>;
};
export type TrustedReportLoader = (tx:SqlClient, schoolId:string, reportId:string, actorMembershipId:string)=>Promise<{projection:ReportCardDraft;context:ReportTrustedContext}|null>;

/** Identifier must be created by the test harness, never taken from user input. */
export function disposableReportTransactionRunner(db:SqlDatabase, schema:string, loadTrusted:TrustedReportLoader, reportTable: 'reports'|'read_reports' = 'reports'):TransactionRunner {
  if(!/^rc_it_[a-f0-9]{16}$/.test(schema))throw Error('Only generated disposable test schema identifiers allowed.');
  const table=(name:string)=>'"'+schema+'"."'+name+'"';
  if(!['reports','read_reports'].includes(reportTable))throw Error('Unsupported disposable report table');
  const reports=table(reportTable), receipts=table('receipts'), audits=table('audits'), releases=table('releases');
  return {
    run<T>(callback:(tx:ReportTransaction)=>Promise<T>):Promise<T> {
      return db.begin(async connection=>{
        let lockedSchool:string|null=null;
        let lockedReport:string|null=null;
        const transaction:ReportTransaction={
          async lockReport(schoolId,reportId,actorMembershipId):Promise<LockedReport|null>{
            const rows=await connection.unsafe('SELECT * FROM '+reports+' WHERE school_id=$1 AND id=$2 FOR UPDATE',[schoolId,reportId]);
            if(rows.length!==1)return null;
            const trusted=await loadTrusted(connection,schoolId,reportId,actorMembershipId);
            if(!trusted)return null;
            lockedSchool=schoolId;lockedReport=reportId;
            return {id:reportId,record:rows[0].record as ReportRecord,projection:trusted.projection,context:trusted.context};
          },
          async findReceipts(schoolId,actorMembershipId,operationKey):Promise<readonly ReportStoredReceipt[]>{
            if(lockedSchool!==schoolId)throw Error('No locked tenant report');
            const rows=await connection.unsafe('SELECT * FROM '+receipts+' WHERE school_id=$1 AND actor_id=$2 AND operation_key=$3',[schoolId,actorMembershipId,operationKey]);
            return rows.map(row=>({schoolId:row.school_id as string,reportId:row.report_id as string,actorMembershipId:row.actor_id as string,operationKey:row.operation_key as string,fingerprint:row.fingerprint as string,resultingVersion:row.resulting_version as number}));
          },
          async updateReport(reportId,beforeVersion,next){
            if(lockedReport!==reportId||lockedSchool!==next.schoolId)throw Error('Locked report mismatch');
            const rows=await connection.unsafe('UPDATE '+reports+' SET version=$1,record=$2::text::jsonb WHERE school_id=$3 AND id=$4 AND version=$5 RETURNING version',[next.version,JSON.stringify(next),next.schoolId,reportId,beforeVersion]);
            return rows.length===1;
          },
          async appendAudit(audit:ReportAudit){
            if(lockedSchool!==audit.schoolId)throw Error('Audit tenant mismatch');
            await connection.unsafe('INSERT INTO '+audits+' (school_id,report_id,version,payload) VALUES ($1,$2,$3,$4::text::jsonb)',[audit.schoolId,lockedReport, audit.version,JSON.stringify(audit)]);
          },
          async appendReceipt(receipt:ReportStoredReceipt){
            if(lockedSchool!==receipt.schoolId||lockedReport!==receipt.reportId)throw Error('Receipt tenant mismatch');
            await connection.unsafe('INSERT INTO '+receipts+' (school_id,actor_id,operation_key,report_id,fingerprint,resulting_version) VALUES ($1,$2,$3,$4,$5,$6)',[receipt.schoolId,receipt.actorMembershipId,receipt.operationKey,receipt.reportId,receipt.fingerprint,receipt.resultingVersion]);
          },
          async appendRelease(release){
            if(lockedSchool!==release.schoolId||lockedReport!==release.reportId)throw Error('Release tenant mismatch');
            await connection.unsafe('INSERT INTO '+releases+' (school_id,report_id,version,published_at) VALUES ($1,$2,$3,$4)',[release.schoolId,release.reportId,release.version,release.publishedAt]);
          }
        };
        return callback(transaction);
      });
    }
  };
}
