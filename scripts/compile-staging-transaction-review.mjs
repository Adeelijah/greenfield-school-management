import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';
import { securityAssertionSql } from './staging-security-assertions.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root,p),'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const expect = (ok,why) => { if (!ok) throw new Error(why); };
const baselinePath = 'docs/security/generated/staging-baseline/0000_broad_slayback.sql';
const expectedHash = 'c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62';
const stages = [
  ['foundation',55], ['auth_foreign_key',1], ['security',35],
  ['effective_privilege_assertions',1], ['migration_journal',1]
];

function main() {
  expect(process.argv.length === 3 && process.argv[2] === '--compile-review', 'Only --compile-review is supported');
  const baseline = read(baselinePath);
  expect(sha(baseline) === expectedHash, 'Generated baseline fingerprint mismatch');
  const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
  const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const fkSource = read('docs/security/05_auth_user_fk_review.sql');
  const fk = fkSource.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(';').map(x=>x.trim()).filter(Boolean);
  const migration = readMigrationFiles({migrationsFolder:resolve(root,'docs/security/generated/staging-baseline')});
  expect(foundation.length===55 && security.length===35 && fk.length===1 &&
    /^ALTER TABLE public\.school_users\s+ADD CONSTRAINT/i.test(fk[0]), 'SQL inventory mismatch');
  expect(migration.length===1 && migration[0].sql.length===55 &&
    migration[0].hash===expectedHash && migration[0].folderMillis===1791835666087,
    'Drizzle migration fingerprint mismatch');
  expect(security.filter(x=>/^CREATE POLICY\b/i.test(x)).length===7,'Policy count mismatch');
  expect(security.filter(x=>/FORCE ROW LEVEL SECURITY/i.test(x)).length===12,'RLS count mismatch');
  expect(/foundation -> this Auth FK -> RLS\/grants -> assertions -> Drizzle journal/.test(fkSource),
    'FK ordering document not reconciled');

  // Structured review metadata, not SQL and not an executable deployer.
  const inventory = [
    ...foundation.map((sql,i)=>({stage:'foundation',ordinal:i+1,sha256:sha(sql)})),
    {stage:'auth_foreign_key',ordinal:1,sha256:sha(fk[0])},
    ...security.map((sql,i)=>({stage:'security',ordinal:i+1,sha256:sha(sql) })),
    {stage:'effective_privilege_assertions',ordinal:1,sha256:sha(securityAssertionSql())}
  ];
  const result = {
    mode:'PHASE4F11_NON_EXECUTABLE_COMPILER',
    targetProjectRef:'hweoqkbgmzycyznrbvng',
    expectedDatabase:'postgres',
    baselineSha256:expectedHash,
    journal:{hash:migration[0].hash,createdAt:migration[0].folderMillis},
    stages:stages.map(([name,statements])=>({name,statements})),
    statementInventory:inventory,
    securityAssertionsStatus:'OFFLINE_INVENTORIED_NOT_REMOTE_TESTED',
    projectIdentityStatus:'OPERATOR VERIFICATION REQUIRED',
    backupAndRecoveryStatus:'NOT APPROVED',
    executionEnabled:false,
    remoteConnectionsMade:false,
    deploymentAuthorized:false
  };
  const out='docs/security/generated/phase4f11-transaction-inventory.json';
  mkdirSync(dirname(resolve(root,out)),{recursive:true});
  writeFileSync(resolve(root,out),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({
    mode:result.mode,output:out,foundationStatements:foundation.length,
    authForeignKeyStatements:fk.length,securityStatements:security.length,
    baselineSha256:expectedHash,inventoryEntries:inventory.length,
    executionEnabled:false,remoteConnectionsMade:false,deploymentAuthorized:false
  },null,2));
}
try { main(); } catch(e) { console.error('Offline compiler refused:',e.message); process.exitCode=1; }
