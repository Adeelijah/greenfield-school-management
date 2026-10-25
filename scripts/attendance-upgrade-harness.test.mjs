import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=new URL('./attendance-postgres-upgrade-integration.mjs',import.meta.url);
function run(extra={}){const env={...process.env};for(const key of ['REPORT_CARD_TEST_DATABASE_URL','REPORT_CARD_TEST_CONFIRM','REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM'])delete env[key];return spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(entry)],{env:{...env,...extra},encoding:'utf8',timeout:30000});}
test('upgraded attendance rehearsal skips before importing driver or missing metadata without both confirmations',()=>{const r=run();assert.equal(r.error,undefined);assert.equal(r.status,2);assert.match(r.stderr,/SKIPPED/);assert.ok(!r.stderr.includes('ERR_MODULE_NOT_FOUND'));});
test('upgrade rehearsal rejects a hosted/staging target before driver or metadata import',()=>{for(const url of ['postgresql://unused@staging.invalid/postgres','postgresql://unused@localhost/postgres','postgresql://unused@localhost/greenfield_report_cards_disposable?options=unsafe']){const r=run({REPORT_CARD_TEST_DATABASE_URL:url,REPORT_CARD_TEST_CONFIRM:'DISPOSABLE_REPORT_CARD_TEST_ONLY',REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM:'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'});assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,/Only the named local disposable/);assert.ok(!r.stderr.includes('ERR_MODULE_NOT_FOUND'));}});
