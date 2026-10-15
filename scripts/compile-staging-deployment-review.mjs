import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const digest = s => createHash('sha256').update(s).digest('hex');
function assert(ok, message) { if (!ok) throw new Error(message); }
function main() {
  assert(process.argv.includes('--compile-review') && !process.argv.includes('--execute'),
    'Only --compile-review is supported; remote execution is not implemented');
  const baseline = read('docs/security/generated/staging-baseline/0000_broad_slayback.sql');
  const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
  const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const fkSource = read('docs/security/05_auth_user_fk_review.sql');
  const fk = fkSource.split('\n').filter(s => !s.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean);
  const migrations = readMigrationFiles({ migrationsFolder: resolve(root,'docs/security/generated/staging-baseline') });
  assert(digest(baseline)==='c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62',
    'Generated baseline fingerprint mismatch');
  assert(foundation.length===55 && security.length===35 && fk.length===1 && migrations.length===1,
    'Unexpected statement inventory');
  assert(/^ALTER TABLE public\.school_users\s+ADD CONSTRAINT/i.test(fk[0]), 'Unexpected FK statement');
  assert(migrations[0].hash===digest(baseline), 'Drizzle hash mismatch');
  const sections=[
    ['foundation',foundation],
    ['auth_fk',fk],
    ['security',security]
  ];
  const compiled=sections.map(([name,statements]) => ({
    name, count:statements.length,
    statements:statements.map((sql,index)=>({index:index+1,sha256:digest(sql),sql}))
  }));
  const artifact={
    mode:'PHASE4F11_OFFLINE_COMPILED_REVIEW',
    targetProjectRef:'hweoqkbgmzycyznrbvng',
    foundationSha256:digest(baseline),
    migrationHash:migrations[0].hash,
    migrationTimestamp:migrations[0].folderMillis,
    sections:compiled,
    expectedPostSqlChecks:{
      forceRlsTables:12,policies:7,authForeignKeys:1,
      requiredDenials:['anon table read','authenticated table write','authenticated student date_of_birth read'],
      additionalReview:['PUBLIC privileges','inherited grants','sequence privileges','future function defaults']
    },
    journalPlan:{
      schema:'drizzle',table:'__drizzle_migrations',
      fields:['hash','created_at'],hash:migrations[0].hash,createdAt:migrations[0].folderMillis
    },
    safety:{
      executable:false,transactionSqlIncluded:false,connectionCodeIncluded:false,
      projectIdentityVerified:false,remoteWritesAuthorized:false
    }
  };
  const dir=resolve(root,'docs/security/generated');
  mkdirSync(dir,{recursive:true});
  const file=resolve(dir,'phase4f11-compiled-deployment-review.json');
  writeFileSync(file,JSON.stringify(artifact,null,2)+'\n');
  console.log(JSON.stringify({
    mode:artifact.mode,output:'docs/security/generated/phase4f11-compiled-deployment-review.json',
    sections:compiled.map(s=>({name:s.name,count:s.count})),
    foundationSha256:artifact.foundationSha256,
    journalMatches:true,executable:false,remoteConnections:false,stagingApproved:false
  },null,2));
}
try { main(); } catch(error) {
  console.error('Offline compilation refused:',error.message);
  process.exitCode=1;
}
