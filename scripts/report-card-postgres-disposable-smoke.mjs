// Disposable PostgreSQL contract tests only. Never imports application schema,
// reads .env files, creates migrations, or connects without explicit opt-in.
// Invoke with a URL for a database CREATED SOLELY for disposable testing.
import assert from 'node:assert/strict';
import postgres from 'postgres';

const url=process.env.REPORT_CARD_TEST_DATABASE_URL;
const token=process.env.REPORT_CARD_TEST_CONFIRM;
if (token !== 'DISPOSABLE_REPORT_CARD_TEST_ONLY' || !url) {
  console.error('SKIPPED: set REPORT_CARD_TEST_CONFIRM and REPORT_CARD_TEST_DATABASE_URL explicitly.');
  process.exitCode=2;
} else {
  let parsed;
  try { parsed=new URL(url); } catch { throw Error('Invalid test database URL'); }
  if (!['postgres:','postgresql:'].includes(parsed.protocol) || !parsed.pathname || parsed.pathname === '/' ||
      !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))) {
    throw Error('Database name must be greenfield_report_cards_disposable (optionally suffixed); refusing connection.');
  }
  const sql=postgres(url,{max:2,connect_timeout:5,prepare:false});
  try {
    // Only create temporary objects. TEMP tables disappear at session end.
    await sql.begin(async tx=>{
      await tx.unsafe('CREATE TEMP TABLE report_contract_probe (id integer PRIMARY KEY, version integer NOT NULL CHECK (version > 0), operation_key text UNIQUE) ON COMMIT DROP');
      await tx.unsafe("INSERT INTO report_contract_probe (id,version,operation_key) VALUES (1,1,'first')");
      const updated=await tx.unsafe('UPDATE report_contract_probe SET version=version+1 WHERE id=1 AND version=1 RETURNING version');
      assert.equal(updated[0]?.version,2,'optimistic update should succeed');
      const stale=await tx.unsafe('UPDATE report_contract_probe SET version=version+1 WHERE id=1 AND version=1 RETURNING version');
      assert.equal(stale.length,0,'stale version must not update');
      const unique=await tx.unsafe("SELECT COUNT(*)::integer AS count FROM report_contract_probe WHERE operation_key='first'");
      assert.equal(unique[0]?.count,1);
    });
    console.log('PASS: disposable PostgreSQL temp-table optimistic-version smoke test');
    // Separate transaction verifies rollback on a failure without persistent schema.
    await sql.begin(async tx=>{
      await tx.unsafe('CREATE TEMP TABLE report_rollback_probe (id integer PRIMARY KEY) ON COMMIT DROP');
      await tx.unsafe('INSERT INTO report_rollback_probe VALUES (1)');
      // Nested savepoint tests PostgreSQL rollback semantics without writing to public schema.
      try { await tx.savepoint(async nested=>{await nested.unsafe('INSERT INTO report_rollback_probe VALUES (2)');throw Error('rollback probe');}); }
      catch(error) {assert.equal(error.message,'rollback probe');}
      const remaining=await tx.unsafe('SELECT id FROM report_rollback_probe ORDER BY id');
      assert.deepEqual(remaining.map(row=>row.id),[1]);
    });
    console.log('PASS: disposable PostgreSQL savepoint rollback smoke test');
  } finally {await sql.end();}
}
