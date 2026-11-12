import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./finance-posting-postgres-integration.mjs',import.meta.url));
const run=(url,role)=>spawnSync(process.execPath,['--experimental-strip-types',entry],{env:{...process.env,REPORT_CARD_TEST_DATABASE_URL:url,REPORT_CARD_TEST_CONFIRM:'DISPOSABLE_REPORT_CARD_TEST_ONLY',REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM:role},encoding:'utf8',timeout:15000});
test('restricted finance harness requires the explicit role confirmation before driver import',()=>{const r=run('postgresql://fixture:fictional@localhost/greenfield_report_cards_disposable','');assert.equal(r.status,2);assert.match(r.stderr,/SKIPPED:/);assert.doesNotMatch(r.stderr,/Cannot find package/);});
test('restricted finance harness rejects remote, wrong database and URL-option targets without leaking URL data',()=>{for(const target of ['staging.invalid/greenfield_report_cards_disposable','localhost/postgres','localhost/greenfield_report_cards_disposable?sslmode=disable']){const r=run('postgresql://fixture:fictional@'+target,'DISPOSABLE_ROLE_ADMIN_TEST_ONLY');assert.equal(r.status,1);assert.match(r.stderr,/phase=target-preflight/);assert.doesNotMatch(r.stderr,/fictional|Cannot find package/);assert.doesNotMatch(r.stdout,/PASS/);}});
