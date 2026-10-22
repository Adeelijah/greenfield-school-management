// Isolated fixture boundary; no driver, SDK, connection or application wiring.
import type { SqlDatabase, SqlClient } from './report-card-postgres-disposable-adapter';
import type { ReportCardActorAuthority } from './report-card-actor-authority';
// @ts-expect-error Node type stripping requires explicit source extension.
import { decodeReportCardActorAuthority } from './report-card-actor-authority.ts';

export type FixtureRequestBinding = Pick<ReportCardActorAuthority, 'authUserId'|'schoolUserId'|'membershipId'|'schoolId'>;
type Failure = {ok:false;code:'invalid'|'forbidden'|'transaction_failed'};
class BoundaryAbort extends Error {
  readonly code: Failure['code'];
  constructor(code: Failure['code']) { super(code); this.code = code; }
}

/** Binding comes from trusted fixture/server code, never a request body. This
 * helper does not authenticate it. Requires the complete authority DDL installed
 * in the same generated fixture and execution as its exact writer role.
 * Order: source SHARE -> complete authority SHARE -> actor/membership/school.
 * Existing writers reuse this outer transaction. Any failed outcome poisons it,
 * including a persistence error caught internally by a writer.
 */
export async function executeCompleteFixtureReport<T extends {ok:boolean}>(
  db: SqlDatabase, schema: string, binding: FixtureRequestBinding,
  work: (scoped: SqlDatabase, identity: () => Promise<{authUserId:string}>, authority: ReportCardActorAuthority) => Promise<T>,
): Promise<T|Failure> {
  if (!/^rc_it_[a-f0-9]{16}$/.test(schema) || !binding ||
    ![binding.authUserId,binding.schoolUserId,binding.membershipId,binding.schoolId].every(v=>typeof v==='string'&&v.trim()) || typeof work!=='function') return {ok:false,code:'invalid'};
  // Capture immutable request fields before the first await.
  const expected = {...binding};
  const table = (name:string) => '"'+schema+'"."'+name+'"';
  let rejected: T|undefined;
  try {
    return await db.begin(async tx=>{
      const role = await tx.unsafe('SELECT current_user AS role');
      if (role.length!==1 || role[0]!.role!==schema+'_writer') throw new BoundaryAbort('forbidden');
      if ((await tx.unsafe('SELECT id FROM '+table('fixture_source_write_gate')+' WHERE id=1 FOR SHARE')).length!==1) throw new BoundaryAbort('transaction_failed');
      const rows = await tx.unsafe('SELECT * FROM '+table('lock_report_card_actor')+'($1::uuid)',[expected.authUserId]);
      const authority = decodeReportCardActorAuthority(expected.authUserId,rows);
      if (!authority || authority.schoolId!==expected.schoolId || authority.schoolUserId!==expected.schoolUserId || authority.membershipId!==expected.membershipId) throw new BoundaryAbort('forbidden');
      let active = true, innerActive = false, poisoned = false;
      const scoped: SqlDatabase = {
        unsafe(){poisoned=true;throw Error('Fixture SQL requires its command transaction');},
        async begin<U>(callback:(connection:SqlClient)=>Promise<U>):Promise<U>{
          if (!active || innerActive) {poisoned=true;throw Error('Invalid fixture transaction reuse');}
          innerActive=true;
          let leaseActive=true;
          const leased:SqlClient={unsafe(query,params){
            if(!active||!leaseActive){poisoned=true;throw Error('Expired fixture transaction lease');}
            try{return tx.unsafe(query,params).catch(error=>{poisoned=true;throw error;});}
            catch(error){poisoned=true;throw error;}
          }};
          try {return await callback(leased);} catch(error){poisoned=true;throw error;} finally{leaseActive=false;innerActive=false;}
        },
      };
      try {
        const result=await work(scoped,async()=>({authUserId:expected.authUserId}),authority);
        if (!result || typeof result.ok!=='boolean') throw new BoundaryAbort('transaction_failed');
        if (!result.ok) {rejected=result;throw new BoundaryAbort('transaction_failed');}
        if (poisoned) throw new BoundaryAbort('transaction_failed');
        return result;
      } finally {active=false;}
    });
  } catch(error) {
    return rejected ?? {ok:false,code:error instanceof BoundaryAbort?error.code:'transaction_failed'};
  }
}
