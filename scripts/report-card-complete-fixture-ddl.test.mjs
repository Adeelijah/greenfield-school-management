import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { completeFixtureAuthorityDDL } from './lib/report-card-complete-fixture-ddl.mjs';
const schema='rc_it_0123456789abcdef';
const proposal=await readFile(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql',import.meta.url),'utf8');
test('complete fixture builder refuses arbitrary identifiers and incomplete review bodies',()=>{
  for(const name of ['public','rc_auth_0123456789abcdef',schema+';'])assert.throws(()=>completeFixtureAuthorityDDL(name,proposal));
  assert.throws(()=>completeFixtureAuthorityDDL(schema,''),/missing/);
  assert.throws(()=>completeFixtureAuthorityDDL(schema,proposal.replaceAll('pg_advisory_xact_lock_shared','invalid_shared')),/contract missing/);
});
test('both shared resolver and exclusive statement trigger acquire source before advisory locks for LF and CRLF',()=>{
  for(const ending of ['\n','\r\n']) {
    const plan=completeFixtureAuthorityDDL(schema,proposal.replace(/\r?\n/g,ending));
    for(const statement of plan.statements.filter(s=>s.startsWith('CREATE FUNCTION'))) {
      assert.ok(statement.indexOf('fixture_source_write_gate')<statement.indexOf('pg_catalog.pg_advisory_xact_lock'));
      assert.doesNotMatch(statement,/public\./);assert.match(statement,/SECURITY DEFINER[\s\S]*SET search_path = pg_catalog/);
    }
  }
});
test('complete owner stays non-login and non-bypass with only three authority tables plus the source gate',()=>{
  const plan=completeFixtureAuthorityDDL(schema,proposal),ddl=plan.statements.join('\n');
  assert.match(ddl,/NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION/);
  const grants=plan.statements.filter(s=>s.startsWith('GRANT SELECT'));
  assert.equal(grants.length,4);assert.equal(grants.some(s=>/report_cards|assessment_scores/.test(s)),false);
  assert.doesNotMatch(ddl,/GRANT .*_authority_owner.* TO /);
});
test('only exact writer executes complete resolver; authority helper stays private and covers all four writer tables',()=>{
  const plan=completeFixtureAuthorityDDL(schema,proposal);
  const execute=plan.statements.filter(s=>s.startsWith('GRANT EXECUTE'));
  assert.deepEqual(execute,['GRANT EXECUTE ON FUNCTION "'+schema+'"."lock_report_card_actor"(uuid) TO "'+schema+'_writer"']);
  assert.equal(plan.statements.filter(s=>s.startsWith('REVOKE ALL ON FUNCTION')).length,2);
  const triggers=plan.statements.filter(s=>s.startsWith('CREATE TRIGGER'));assert.equal(triggers.length,4);
  for(const name of ['school_users','memberships','schools','teacher_class_assignments'])assert.ok(triggers.some(s=>s.includes('ON "'+schema+'"."'+name+'" FOR EACH STATEMENT')));
});
