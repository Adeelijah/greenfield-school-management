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
export async function lockFixtureReportActor(tx: SqlClient, schema: string, verifiedIdentity: () => Promise<{authUserId:string}|null>): Promise<{ok:true;authUserId:string;identity:MappedReportIdentity}|{ok:false;code:'invalid'|'unauthenticated'|'forbidden'|'transaction_failed'}> {
 if (!/^rc_it_[a-f0-9]{16}$/.test(schema)) return {ok:false,code:'invalid'};
 const auth = await verifiedIdentity(); if (!auth?.authUserId?.trim()) return {ok:false,code:'unauthenticated'};
 const table = (name:string) => '"'+schema+'"."'+name+'"';
 if ((await tx.unsafe('SELECT id FROM '+table('fixture_source_write_gate')+' WHERE id=1 FOR SHARE')).length!==1) return {ok:false,code:'transaction_failed'};
 const users = await tx.unsafe('SELECT id,auth_user_id AS "authUserId" FROM '+table('school_users')+' WHERE auth_user_id=$1::uuid FOR UPDATE',[auth.authUserId]);
 if (users.length!==1) return {ok:false,code:'forbidden'};
 const memberships = await tx.unsafe('SELECT id,school_id AS "schoolId",user_id AS "userId",role,status FROM '+table('memberships')+' WHERE user_id=$1::uuid ORDER BY id FOR SHARE',[users[0]!.id]);
 const schools = await tx.unsafe('SELECT id,final_primary_year AS "finalPrimaryYear" FROM '+table('schools')+' WHERE id IN (SELECT school_id FROM '+table('memberships')+' WHERE user_id=$1::uuid) ORDER BY id FOR SHARE',[users[0]!.id]);
 const mapped = mapPersistedReportIdentity(auth.authUserId,d.decodeIdentityRows({users,memberships,schools}));
 return mapped.ok ? {ok:true,authUserId:auth.authUserId,identity:mapped.identity} : {ok:false,code:'forbidden'};
}
