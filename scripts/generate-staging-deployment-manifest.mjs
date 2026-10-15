import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { inspectFoundationStatements } from './validate-isolated-foundation.mjs';
import { securityStatements } from './validate-isolated-security.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root,p),'utf8');
const hash = x => createHash('sha256').update(x).digest('hex');
function requireCondition(value,message) { if (!value) throw new Error(message); }
function main() {
  requireCondition(process.argv.includes('--generate-review'), 'Explicit --generate-review required');
  const source = read('drizzle/0000_broad_slayback.sql');
  const baseline = read('docs/security/generated/staging-baseline/0000_broad_slayback.sql');
  const foundation = inspectFoundationStatements(source).statements;
  const security = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const migration = readMigrationFiles({migrationsFolder:resolve(root,'docs/security/generated/staging-baseline')});
  const fk = read('docs/security/05_auth_user_fk_review.sql').split('\n').filter(l=>!l.trim().startsWith('--')).join('\n').split(';').map(s=>s.trim()).find(s=>s.startsWith('ALTER TABLE'));
  requireCondition(hash(baseline)==='c8f61c5f702ae6ebad9cc2950edb1d4a288eb2a2613281cdc612167b711cba62', 'Baseline mismatch');
  requireCondition(foundation.length===55 && security.length===35 && migration.length===1 && migration[0].sql.length===55 && !!fk,'SQL inventory mismatch');
  const manifest = {
    mode:'PHASE4F10_STAGING_DEPLOYMENT_MANIFEST_REVIEW',
    targetProjectRef:'hweoqkbgmzycyznrbvng',
    targetProjectName:'greenfield-staging',
    expectedDatabaseName:'postgres',
    warning:'Database name is not a unique project identity; independently confirm project ref and connection host.',
    foundationSha256:hash(baseline),
    migrationHash:migration[0].hash,
    migrationTimestamp:migration[0].folderMillis,
    foundationStatements:55,
    authForeignKeyStatements:1,
    securityStatements:35,
    order:['preflight','foundation','auth_fk','security','assertions','journal','commit_only_after_approval'],
    blockingGates:[
      'Reconcile Auth FK ordering in existing review document',
      'Independently confirm target project and credential scope',
      'Review effective privileges after SQL execution within transaction',
      'Approve complete executable runner and recovery procedure',
      'Obtain explicit user authorization to modify greenfield-staging'
    ],
    noExecutableSql:true,
    noNetworkConnections:true,
    deploymentAuthorized:false
  };
  const dir=resolve(root,'docs/security/generated');
  mkdirSync(dir,{recursive:true});
  const out=resolve(dir,'phase4f10-staging-deployment-manifest.json');
  writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({...manifest,output:'docs/security/generated/phase4f10-staging-deployment-manifest.json'},null,2));
}
try { main(); } catch(error) { console.error('Manifest generation refused:',error.message);process.exitCode=1; }
