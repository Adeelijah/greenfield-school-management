import test from 'node:test';
import assert from 'node:assert/strict';
import { reportReleaseGuardDDL } from './lib/report-release-disposable-guards.mjs';
const schema='rc_it_0123456789abcdef';
test('release guard rejects arbitrary identifiers before preparing SQL',()=>{
 for(const name of ['public','rc_it_bad',schema+'";DROP ROLE postgres'])assert.throws(()=>reportReleaseGuardDDL(name));
});
test('release guard freezes all original publication fields and permits only initial revocation',()=>{
 const sql=reportReleaseGuardDDL(schema).statements.join('\n');
 assert.ok(sql.includes("(to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')"));
 assert.ok(sql.includes('OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_at<OLD.released_at'));
 assert.ok(sql.includes("TG_OP='INSERT'"));assert.ok(sql.includes('NEW.revoked_at IS NOT NULL'));
});
test('release history rejects deletion and truncate even when statements match no rows',()=>{
 const sql=reportReleaseGuardDDL(schema).statements.join('\n');
 for(const action of ['DELETE','TRUNCATE'])assert.ok(sql.includes('BEFORE '+action+' ON "'+schema+'"."report_card_releases" FOR EACH STATEMENT'));
});
test('release guards remain invoker fixture functions without role or policy changes',()=>{
 const sql=reportReleaseGuardDDL(schema).statements.join('\n');assert.ok(sql.includes('SET search_path=pg_catalog'));
 for(const word of ['SECURITY DEFINER','public.','CREATE ROLE','GRANT ','ALTER POLICY'])assert.equal(sql.includes(word),false);
});
