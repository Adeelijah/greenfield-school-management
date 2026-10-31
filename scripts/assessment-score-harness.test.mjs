import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./assessment-score-postgres-integration.mjs',import.meta.url));
const env={...process.env};delete env.REPORT_CARD_TEST_DATABASE_URL;delete env.REPORT_CARD_TEST_CONFIRM;delete env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM;
test('score rehearsal skips with status two before driver/metadata imports without explicit confirmations',()=>{const r=spawnSync(process.execPath,['--experimental-strip-types',entry],{env,encoding:'utf8',timeout:30000});assert.equal(r.error,undefined);assert.equal(r.status,2);assert.match(r.stderr,/SKIPPED: local disposable/);assert.ok(!r.stderr.includes('Cannot find'));});
test('score rehearsal refuses hosted staging before any database driver import',()=>{const r=spawnSync(process.execPath,['--experimental-strip-types',entry],{env:{...env,REPORT_CARD_TEST_DATABASE_URL:'postgresql://fictional:fictional@hosted.example:5432/postgres',REPORT_CARD_TEST_CONFIRM:'DISPOSABLE_REPORT_CARD_TEST_ONLY',REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM:'DISPOSABLE_ROLE_ADMIN_TEST_ONLY'},encoding:'utf8',timeout:30000});assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,/Only the named local disposable/);assert.ok(!r.stderr.includes('Cannot find'));});
