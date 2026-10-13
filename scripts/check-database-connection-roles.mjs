// Read-only check of the actual application and migration DB identities.
// Never logs credentials, hostnames, URLs, or query results containing user data.
// Does not create roles, apply migrations or change database permissions.
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

export function connectionRisk(app, migration) {
  if (!app.configured) return 'APP_URL_MISSING';
  if (!migration.configured) return 'MIGRATION_URL_MISSING';
  if (app.error || migration.error) return 'CONNECTION_CHECK_FAILED';
  if (app.bypassRls || app.superuser) return 'APP_ROLE_BYPASSES_RLS';
  if (app.role === migration.role && app.database === migration.database) return 'APP_SHARES_MIGRATION_ROLE';
  if (app.database !== migration.database) return 'DIFFERENT_DATABASES_REVIEW_REQUIRED';
  return 'IDENTITIES_DISTINCT_REVIEW_GRANTS';
}

async function inspect(url) {
  if (!url) return { configured: false };
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 8, idle_timeout: 3 });
  try {
    const [row] = await sql`
      SELECT current_database() AS database,
        current_user AS role,
        r.rolbypassrls AS bypass_rls,
        r.rolsuper AS superuser
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    return {
      configured: true, database: row.database, role: row.role,
      bypassRls: row.bypass_rls, superuser: row.superuser
    };
  } catch {
    // Errors may contain sensitive URL fragments; never print raw exceptions.
    return { configured: true, error: 'Connection or catalog query failed' };
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* no secret logging */ }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = await inspect(process.env.DATABASE_URL);
  const migration = await inspect(process.env.MIGRATION_DATABASE_URL);
  const result = {
    mode: 'READ_ONLY_CONNECTION_IDENTITY_CHECK',
    application: app, migration,
    sameUrlConfigured: Boolean(process.env.DATABASE_URL && process.env.MIGRATION_DATABASE_URL && process.env.DATABASE_URL === process.env.MIGRATION_DATABASE_URL),
    risk: connectionRisk(app, migration),
    note: 'No roles or privileges were changed. Do not apply migrations based on this result.'
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.risk !== 'IDENTITIES_DISTINCT_REVIEW_GRANTS') process.exitCode = 1;
}
