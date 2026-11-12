import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {financePostingFixturePlan,financeUpgradePostingFixturePlan} from './lib/finance-posting-fixture.mjs';
import {reportUpgradeSourcePlan} from './lib/report-card-upgrade-plan.mjs';
import {executeFinanceUpgradePostingFixture} from '../src/lib/finance/finance-postgres-fixture.ts';

const schema='rc_it_0123456789abcdef',plan=financeUpgradePostingFixturePlan(schema);
test('upgraded finance binds the existing school, term, enrollment and membership keys without creating duplicate parents',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const source=reportUpgradeSourcePlan(schema,read('drizzle/0000_broad_slayback.sql'),read('docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql'));
 assert.equal(plan.storage.parents.length,0);assert.equal(plan.storage.tables.length,10);
 const dependencies=source.dependencyStatements.join('\n');
 assert.match(dependencies,/terms_school_session_id_unique .*\(school_id, session_id, id\)/);
 assert.match(dependencies,/enrollments_report_binding_unique .*\(school_id, id, student_id, class_id, session_id\)/);
 assert.match(dependencies,/memberships_school_id_id_unique .*\(school_id, id\)/);
 assert.match(plan.storage.tables.join('\n'),/FOREIGN KEY\(school_id,session_id,term_id\) REFERENCES .*"terms"\(school_id,session_id,id\)/);
});
test('upgraded finance takes the existing shared gate before its finance lock and does not replace parent triggers',()=>{
 assert.match(plan.statements[0],/relrowsecurity AND c.relforcerowsecurity/);
 assert.match(plan.statements[0],/tgfoid=.*fixture_lock_source_write/);
 const gate=plan.post.indexOf('"fixture_source_write_gate" WHERE id=1 FOR SHARE');
 assert.ok(gate>0&&gate<plan.post.indexOf('pg_advisory_xact_lock')&&plan.post.indexOf('pg_advisory_xact_lock')<plan.post.indexOf('WHERE u.auth_user_id=verified_auth'));
 assert.equal(plan.statements.filter(s=>s.startsWith('CREATE TRIGGER finance_discovery')).length,10);
 assert.ok(plan.statements.filter(s=>s.startsWith('CREATE TRIGGER finance_discovery')).every(s=>s.includes(' ON "'+schema+'"."finance_')));
});
test('upgraded grants avoid broad schema revocations and do not expose report, assessment or enrollment rows',()=>{
 assert.ok(!plan.statements.some(s=>s.includes('ALL TABLES IN SCHEMA')||s.includes('ALL FUNCTIONS IN SCHEMA')||s.startsWith('REVOKE ALL ON SCHEMA')));
 const reads=plan.statements.find(s=>s.startsWith('GRANT SELECT ON'));
 assert.ok(reads.includes('"memberships"')&&reads.includes('"school_users"')&&reads.includes('"fixture_source_write_gate"'));
 assert.doesNotMatch(reads,/"(?:report_card\w*|assessment_\w*|enrollments|students)"/);
 assert.match(plan.statements.join('\n'),/FOR UPDATE TO .*_finance_owner" USING \(id=1\) WITH CHECK \(false\)/);
});
test('minimal, upgraded and live schema names cannot be substituted across fixture plans',()=>{
 assert.throws(()=>financePostingFixturePlan(schema));
 for(const name of ['fi_it_0123456789abcdef','public','rc_it_0123456789abcdef;'])assert.throws(()=>financeUpgradePostingFixturePlan(name));
 assert.equal(plan.roles.login,schema+'_finance_login');assert.equal(plan.roles.worker,schema+'_finance_worker');
});
test('the upgraded command adapter accepts only its finance login and SET-only worker',async()=>{
 const uuid='00000000-0000-4000-8000-000000000001',called=[];
 const command={action:'record_payment',invoiceId:uuid,expectedVersion:1,operationKey:'finance-upgrade-1',amount:'1',method:'cash',reference:null,receivedOn:'2026-11-12'};
 const expected={ok:true,kind:'applied',result:{ok:true,action:'record_payment',invoiceId:uuid,version:2,eventId:uuid,receiptId:uuid}};
 const fixture=login=>({async begin(work){let role=login;return work({async unsafe(sql){called.push(sql);if(sql.startsWith('SELECT session_user'))return [{login,role}];if(sql.startsWith('SET LOCAL ROLE')){role=plan.roles.worker;return [];}return [{outcome:expected}];}});}});
 assert.deepEqual(await executeFinanceUpgradePostingFixture(fixture(schema+'_login'),schema,async()=>({authUserId:uuid}),command),{ok:false,code:'forbidden'});
 assert.equal(called.length,1);
 assert.deepEqual(await executeFinanceUpgradePostingFixture(fixture(plan.roles.login),schema,async()=>({authUserId:uuid}),command),expected);
 assert.ok(called.includes('SET LOCAL ROLE "'+plan.roles.worker+'"'));
});
test('invalid upgraded rehearsal arguments are rejected before connecting to the local database',()=>{
 const path=fileURLToPath(new URL('./finance-posting-postgres-integration.mjs',import.meta.url));
 const result=spawnSync(process.execPath,['--experimental-strip-types',path,'--public'],{env:{...process.env,REPORT_CARD_TEST_DATABASE_URL:'postgresql://fixture:unused@localhost/greenfield_report_cards_disposable',REPORT_CARD_TEST_CONFIRM:'DISPOSABLE_REPORT_CARD_TEST_ONLY',REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM:'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'},encoding:'utf8',timeout:15000});
 assert.equal(result.status,1);assert.match(result.stderr,/phase=target-preflight/);assert.doesNotMatch(result.stderr,/unused|Cannot find package/);
});
