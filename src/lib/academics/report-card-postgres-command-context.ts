import type { ReportSqlScope } from './report-card-sql-scope';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { fixtureReportSqlScope, isReportSqlScope, lockReportSqlScopeAuthority, matchesReportSqlAuthority } from './report-card-sql-scope.ts';
// Fixture mutation identity boundary. No connection, SDK or environment access.
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { MappedReportIdentity } from './report-card-persisted-model-map';
// @ts-expect-error Node type stripping requires explicit source extension.
import { fixtureAssessmentDecoders as d } from './assessment-postgres-fixture-source-reader.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { mapPersistedReportIdentity } from './report-card-persisted-model-map.ts';
/** Mutation lock order: shared source gate, exclusive school-user actor anchor,
 * membership/school, then creation identity (if any) and report row. Serializes
 * actor-scoped operation keys across creation and approval command families.
 * Read adapters take shared user locks and cannot upgrade into mutations.
 */
export async function lockReportActorInScope(tx: SqlClient, sqlScope: ReportSqlScope, verifiedIdentity: () => Promise<{authUserId:string}|null>): Promise<{ok:true;authUserId:string;identity:MappedReportIdentity}|{ok:false;code:'invalid'|'unauthenticated'|'forbidden'|'transaction_failed'}> {
 if (!isReportSqlScope(sqlScope)) return {ok:false,code:'invalid'};
 const auth = await verifiedIdentity(); if (!auth?.authUserId?.trim()) return {ok:false,code:'unauthenticated'};
 const authority = await lockReportSqlScopeAuthority(tx, sqlScope, auth.authUserId); if (authority === false) return {ok:false,code:'forbidden'};
 const table = (name:string) => '"'+sqlScope.schema+'"."'+name+'"';
 if ((await tx.unsafe('SELECT id FROM '+table(sqlScope.sourceGate)+' WHERE id=1 FOR SHARE')).length!==1) return {ok:false,code:'transaction_failed'};
 const users = await tx.unsafe('SELECT id,auth_user_id AS "authUserId" FROM '+table('school_users')+' WHERE auth_user_id=$1::uuid FOR UPDATE',[auth.authUserId]);
 if (users.length!==1) return {ok:false,code:'forbidden'};
 const memberships = await tx.unsafe('SELECT id,school_id AS "schoolId",user_id AS "userId",role,status FROM '+table('memberships')+' WHERE user_id=$1::uuid ORDER BY id FOR SHARE',[users[0]!.id]);
 const schools = await tx.unsafe('SELECT id,final_primary_year AS "finalPrimaryYear" FROM '+table('schools')+' WHERE id IN (SELECT school_id FROM '+table('memberships')+' WHERE user_id=$1::uuid) ORDER BY id FOR SHARE',[users[0]!.id]);
 const mapped = mapPersistedReportIdentity(auth.authUserId,d.decodeIdentityRows({users,memberships,schools}));
 return mapped.ok && matchesReportSqlAuthority(authority,mapped.identity,users[0]!.id) ? {ok:true,authUserId:auth.authUserId,identity:mapped.identity} : {ok:false,code:'forbidden'};
}


/** Disposable compatibility entry: public remains invalid. */
export async function lockFixtureReportActor(tx: SqlClient, schema: string, verifiedIdentity: () => Promise<{authUserId:string}|null>) { const scope = fixtureReportSqlScope(schema); return scope ? lockReportActorInScope(tx, scope, verifiedIdentity) : {ok:false,code:'invalid'} as const; }
